import { queueIdentityEmail } from "@/server/notifications/identity-events";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink, oAuthProxy, organization } from "better-auth/plugins";
import { and, eq, gt, inArray } from "drizzle-orm";
import { passkey } from "@better-auth/passkey";
import { db } from "@/db/client";
import * as schema from "@/db/auth-schema";
import { TWITCH_ADDITIONAL_SCOPES } from "./providers/twitch";
import { refreshTwitchAccessToken } from "./providers/twitch-refresh";
import { betterAuthOrganizationRoles, clipifyAccessControl } from "./organization-access";
import { EMAIL_OTP_POLICY } from "./credential-policy";
import { sendAuthOtp, sendTeamInvitation } from "./transactional-mail";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { requiredAuthSetting } from "./environment";
import { evaluateRoleAssignment } from "./role-assignment-policy";
import { createMcpPlugins } from "./mcp-options";
import { providerGrantOptions } from "@/server/mcp/grants";
import { withResourceSeedErrorCompatibility } from "./resource-seed-adapter";

const resolvedBaseUrl = resolveBaseUrl();
const baseURL = resolvedBaseUrl.origin;
const productionURL = "https://clipify.us";
const isLoopbackOrigin = ["localhost", "127.0.0.1", "::1"].includes(resolvedBaseUrl.hostname);
const oauthProxySecret = process.env.OAUTH_PROXY_SECRET?.trim() || undefined;

export const auth = betterAuth({
	appName: "Clipify",
	baseURL,
	trustedOrigins: [baseURL, productionURL, "https://www.clipify.us", "https://es.clipify.us", "http://localhost:3000", "https://*.clipify.cloud.thedannicraft.de"],
	secret: requiredAuthSetting("BETTER_AUTH_SECRET", "JWT_SECRET"),
	database: withResourceSeedErrorCompatibility(
		drizzleAdapter(db, {
			provider: "pg",
			schemaName: "auth",
			schema,
		}),
	),
	socialProviders: {
		twitch: {
			clientId: requiredAuthSetting("TWITCH_CLIENT_ID"),
			clientSecret: requiredAuthSetting("TWITCH_CLIENT_SECRET"),
			scope: TWITCH_ADDITIONAL_SCOPES,
			refreshAccessToken: refreshTwitchAccessToken,
			requireEmailVerification: true,
		},
	},
	session: {
		cookieCache: { enabled: false },
		freshAge: 5 * 60,
	},
	account: {
		encryptOAuthTokens: true,
		updateAccountOnSignIn: true,
		storeStateStrategy: "cookie",
		accountLinking: {
			enabled: true,
			disableImplicitLinking: true,
			allowDifferentEmails: false,
			allowUnlinkingAll: false,
		},
	},
	databaseHooks: {
		account: {
			create: {
				after: async (account, context) => {
					if (account.providerId === "twitch" && (context?.path === "/callback/twitch" || (context?.path === "/callback/:id" && context.params?.id === "twitch"))) {
						const { restoreTwitchAccountAccess } = await import("@/server/notifications/twitch-account-access");
						await restoreTwitchAccountAccess(account.userId);
					}
				},
			},
			update: {
				after: async (account, context) => {
					if (account.providerId === "twitch" && (context?.path === "/callback/twitch" || (context?.path === "/callback/:id" && context.params?.id === "twitch"))) {
						const { restoreTwitchAccountAccess } = await import("@/server/notifications/twitch-account-access");
						await restoreTwitchAccountAccess(account.userId);
					}
				},
			},
		},
		user: {
			create: {
				after: async (user) => {
					await queueIdentityEmail(user.email, { type: "welcome", name: user.name }, `welcome:${user.id}`);
				},
			},
			update: {
				after: async (user, context) => {
					const previousEmail = context?.context.session?.user.email;
					if (previousEmail && previousEmail !== user.email) {
						const key = randomUUID();
						await Promise.all([previousEmail, user.email].map((email) => queueIdentityEmail(email, { type: "security", change: "email-changed" }, `email-change:${key}:${email === previousEmail ? "old" : "new"}`)));
					}
				},
			},
		},
	},
	rateLimit: {
		enabled: true,
		storage: "database",
		modelName: "rateLimit",
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/social": { window: 60, max: 10 },
			"/email-otp/send-verification-otp": { window: 10 * 60, max: 3 },
			"/sign-in/email-otp": { window: 10 * 60, max: 5 },
			"/passkey/*": { window: 60, max: 10 },
		},
	},
	hooks: {
		after: createAuthMiddleware(async (context) => {
			const change = context.path === "/passkey/verify-registration" ? "passkey-added" : context.path === "/passkey/delete-passkey" ? "passkey-removed" : null;
			if (!change || context.context.returned instanceof APIError) return;
			const result = context.context.returned as { status?: boolean; id?: string } | null;
			if (!result || (change === "passkey-removed" ? result.status !== true : !result.id)) return;
			const session = await getSessionFromCtx(context);
			if (session) await queueIdentityEmail(session.user.email, { type: "security", change }, `security:${randomUUID()}`);
		}),
		before: createAuthMiddleware(async (context) => {
			if (context.path !== "/organization/update-member-role" && context.path !== "/organization/invite-member") return;
			const body = context.body as { organizationId?: unknown; memberId?: unknown; role?: unknown };
			const requestedRole = typeof body.role === "string" ? body.role : Array.isArray(body.role) && body.role.every((role): role is string => typeof role === "string") ? body.role.join(",") : null;
			if (!requestedRole || (context.path === "/organization/update-member-role" && typeof body.memberId !== "string")) return;

			const session = await getSessionFromCtx(context);
			const organizationId = typeof body.organizationId === "string" ? body.organizationId : session?.session.activeOrganizationId;
			if (!session || !organizationId) return;

			const [actorMember] = await db
				.select({ id: schema.member.id, role: schema.member.role })
				.from(schema.member)
				.where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, session.user.id)))
				.limit(1);
			if (!actorMember) return;

			const targetMember =
				context.path === "/organization/update-member-role"
					? (
							await db
								.select({ id: schema.member.id })
								.from(schema.member)
								.where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.id, body.memberId as string)))
								.limit(1)
						)[0]
					: undefined;
			const requestedRoleNames = requestedRole
				.split(",")
				.map((role) => role.trim())
				.filter(Boolean);
			const actorRoleNames = actorMember.role
				.split(",")
				.map((role) => role.trim())
				.filter(Boolean);
			const dynamicRoleNames = [...new Set([...actorRoleNames, ...requestedRoleNames])].filter((role) => !Object.prototype.hasOwnProperty.call(betterAuthOrganizationRoles, role));
			const dynamicRoleRows = dynamicRoleNames.length
				? await db
						.select({ role: schema.organizationRole.role, permission: schema.organizationRole.permission })
						.from(schema.organizationRole)
						.where(and(eq(schema.organizationRole.organizationId, organizationId), inArray(schema.organizationRole.role, dynamicRoleNames)))
				: [];
			const dynamicRoles = new Map(
				dynamicRoleRows.map((role) => {
					try {
						return [role.role, JSON.parse(role.permission) as Record<string, string[]>] as const;
					} catch {
						return [role.role, {}] as const;
					}
				}),
			);
			const decision = evaluateRoleAssignment({ actorMemberId: actorMember.id, targetMemberId: targetMember?.id, actorRole: actorMember.role, requestedRole, dynamicRoles });
			if (!decision.allowed) throw new APIError("FORBIDDEN", { code: decision.code, message: decision.code });
		}),
	},
	plugins: [
		...createMcpPlugins({ origin: baseURL, options: providerGrantOptions }),
		magicLink({
			expiresIn: 7 * 24 * 60 * 60,
			storeToken: "hashed",
			sendMagicLink: async ({ email, url, metadata }) => {
				const invitationId = typeof metadata?.invitationId === "string" ? metadata.invitationId : "";
				if (!invitationId) return;
				const rows = await db
					.select({ invitationEmail: schema.invitation.email, organizationName: schema.organization.name })
					.from(schema.invitation)
					.innerJoin(schema.organization, eq(schema.invitation.organizationId, schema.organization.id))
					.where(and(eq(schema.invitation.id, invitationId), eq(schema.invitation.status, "pending"), gt(schema.invitation.expiresAt, new Date())))
					.limit(1);
				const pendingInvitation = rows[0];
				if (!pendingInvitation || pendingInvitation.invitationEmail.toLowerCase() !== email.toLowerCase()) return;
				await sendTeamInvitation({ email: pendingInvitation.invitationEmail, invitationUrl: url, organizationName: pendingInvitation.organizationName });
			},
		}),
		oAuthProxy({
			// Twitch accepts the registered localhost callback directly. Only remote
			// non-production deployments need to traverse the stable production URL.
			productionURL: isLoopbackOrigin ? baseURL : productionURL,
			secret: oauthProxySecret,
			maxAge: 60,
		}),
		emailOTP({
			expiresIn: EMAIL_OTP_POLICY.expiresInSeconds,
			allowedAttempts: EMAIL_OTP_POLICY.allowedAttempts,
			resendStrategy: EMAIL_OTP_POLICY.resendStrategy,
			storeOTP: EMAIL_OTP_POLICY.storage,
			disableSignUp: false,
			changeEmail: { enabled: true, verifyCurrentEmail: true },
			sendVerificationOTP: async (input) => {
				// The account-security action sends change-email codes synchronously so
				// delivery failures reach the UI instead of being swallowed by Better Auth's background runner.
				if (input.type === "change-email") return;
				await sendAuthOtp(input);
			},
		}),
		passkey({
			rpName: "Clipify",
			rpID: resolvedBaseUrl.hostname,
			origin: resolvedBaseUrl.origin,
		}),
		organization({
			ac: clipifyAccessControl,
			roles: betterAuthOrganizationRoles,
			dynamicAccessControl: { enabled: true },
			invitationExpiresIn: 7 * 24 * 60 * 60,
			cancelPendingInvitationsOnReInvite: true,
			requireEmailVerificationOnInvitation: true,
			organizationHooks: {
				afterAcceptInvitation: async ({ user, organization, invitation }) => queueIdentityEmail(user.email, { type: "organization-membership", organizationName: organization.name, status: "joined" }, `organization-joined:${invitation.id}`),
				afterRemoveMember: async ({ user, organization, member }) => queueIdentityEmail(user.email, { type: "organization-membership", organizationName: organization.name, status: "removed" }, `organization-removed:${member.id}`),
			},
		}),
	],
});

// Better Auth runs database `after` hooks only after its adapter transaction
// commits. The reviewed PostgreSQL boundary in onboarding-database-boundary.ts
// provisions creator ownership inside the account insert transaction and is
// verified by TDD-US2-003.
