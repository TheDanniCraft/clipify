import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, oAuthProxy, organization } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/db/client";
import * as schema from "@/db/auth-schema";
import { TWITCH_ADDITIONAL_SCOPES } from "./providers/twitch";
import { betterAuthOrganizationRoles, clipifyAccessControl } from "./organization-access";
import { EMAIL_OTP_POLICY } from "./credential-policy";
import { sendAuthOtp } from "./transactional-mail";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { requiredAuthSetting } from "./environment";

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
	database: drizzleAdapter(db, {
		provider: "pg",
		schemaName: "auth",
		schema,
	}),
	socialProviders: {
		twitch: {
			clientId: requiredAuthSetting("TWITCH_CLIENT_ID"),
			clientSecret: requiredAuthSetting("TWITCH_CLIENT_SECRET"),
			scope: TWITCH_ADDITIONAL_SCOPES,
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
	plugins: [
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
		}),
	],
});

// Better Auth runs database `after` hooks only after its adapter transaction
// commits. The reviewed PostgreSQL boundary in onboarding-database-boundary.ts
// provisions creator ownership inside the account insert transaction and is
// verified by TDD-US2-003.
