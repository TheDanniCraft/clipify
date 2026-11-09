import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

export const eventGoogleProviderIds = { drive: "google-drive", youtube: "google-events-youtube" } as const;
export function isGoogleProvider(providerId: string) {
	return providerId === "google" || providerId === eventGoogleProviderIds.drive || providerId === eventGoogleProviderIds.youtube;
}

export function eventGoogleProviders(environment: NodeJS.ProcessEnv = process.env): GenericOAuthConfig[] {
	const clientId = environment.YOUTUBE_CLIENT_ID?.trim();
	const clientSecret = environment.YOUTUBE_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) return [];
	return Object.values(eventGoogleProviderIds).map((providerId) => ({
		providerId,
		clientId,
		clientSecret,
		discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
		requireIdTokenVerification: true,
		scopes: ["openid", "email", "profile"],
		accessType: "offline",
		prompt: "consent",
		disableSignUp: true,
		authorizationUrlParams: { include_granted_scopes: "false" },
	}));
}
