import type { TwitchProfile } from "@better-auth/core/social-providers";

export const TWITCH_REQUIRED_SCOPES = ["openid", "user:read:email", "channel:bot", "channel:read:redemptions", "channel:manage:redemptions", "channel:manage:clips"] as const;
export const TWITCH_ADDITIONAL_SCOPES = TWITCH_REQUIRED_SCOPES.filter((scope) => scope !== "openid" && scope !== "user:read:email");

export class TwitchProviderContractError extends Error {
	constructor(
		readonly code: "TWITCH_PROFILE_INVALID" | "TWITCH_EMAIL_UNVERIFIED" | "TWITCH_INSUFFICIENT_SCOPES",
		readonly details: Record<string, unknown> = {},
	) {
		super(code);
		this.name = "TwitchProviderContractError";
	}
}

export function validateTwitchProfile(profile: TwitchProfile, grantedScopes: string[]) {
	if (!profile.sub?.trim() || !profile.email?.trim()) throw new TwitchProviderContractError("TWITCH_PROFILE_INVALID");
	if (!profile.email_verified) throw new TwitchProviderContractError("TWITCH_EMAIL_UNVERIFIED");

	const normalizedScopes = new Set(grantedScopes.map((scope) => scope.trim()).filter(Boolean));
	const missingScopes = TWITCH_REQUIRED_SCOPES.filter((scope) => !normalizedScopes.has(scope));
	if (missingScopes.length > 0) {
		throw new TwitchProviderContractError("TWITCH_INSUFFICIENT_SCOPES", { grantedScopes: [...normalizedScopes], missingScopes });
	}

	return {
		subject: profile.sub,
		username: profile.preferred_username,
		email: profile.email.trim().toLowerCase(),
		emailVerified: true as const,
		image: profile.picture,
	};
}
