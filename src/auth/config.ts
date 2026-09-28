import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/db/client";
import * as schema from "@/db/auth-schema";
import { TWITCH_ADDITIONAL_SCOPES } from "./providers/twitch";
import { betterAuthOrganizationRoles, clipifyAccessControl } from "./organization-access";
import { EMAIL_OTP_POLICY } from "./credential-policy";
import { sendAuthOtp } from "./transactional-mail";

function generationFallback(name: string): string | undefined {
	if (!process.argv.includes("generate") && process.env.APP_ENV !== "test") return undefined;
	if (name === "BETTER_AUTH_URL") return "http://localhost:3000";
	if (name === "BETTER_AUTH_SECRET") return "schema-generation-only-secret-at-least-32-characters";
	return `schema-generation-${name.toLowerCase()}`;
}

function requiredSetting(name: string, legacyName?: string): string {
	const value = process.env[name] ?? (legacyName ? process.env[legacyName] : undefined) ?? generationFallback(name);
	if (!value) throw new Error(`${name} must be injected by Infisical`);
	return value;
}

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? generationFallback("BETTER_AUTH_URL");
const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? baseURL ?? "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

export const auth = betterAuth({
	appName: "Clipify",
	baseURL,
	secret: requiredSetting("BETTER_AUTH_SECRET", "JWT_SECRET"),
	database: drizzleAdapter(db, {
		provider: "pg",
		schemaName: "auth",
		schema,
	}),
	trustedOrigins,
	socialProviders: {
		twitch: {
			clientId: requiredSetting("TWITCH_CLIENT_ID"),
			clientSecret: requiredSetting("TWITCH_CLIENT_SECRET"),
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
		emailOTP({
			expiresIn: EMAIL_OTP_POLICY.expiresInSeconds,
			allowedAttempts: EMAIL_OTP_POLICY.allowedAttempts,
			resendStrategy: EMAIL_OTP_POLICY.resendStrategy,
			storeOTP: EMAIL_OTP_POLICY.storage,
			disableSignUp: false,
			changeEmail: { enabled: true, verifyCurrentEmail: true },
			sendVerificationOTP: sendAuthOtp,
		}),
		passkey({
			rpName: requiredSetting("WEBAUTHN_RP_NAME"),
			rpID: requiredSetting("WEBAUTHN_RP_ID"),
			origin: requiredSetting("WEBAUTHN_ORIGIN"),
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

// Creator/account/owner creation is enforced by the reviewed PostgreSQL
// trigger in the auth foundation migration. Because it fires on the Better
// Auth account insert, every domain record shares Better Auth's OAuth database
// transaction and rolls back with it.
