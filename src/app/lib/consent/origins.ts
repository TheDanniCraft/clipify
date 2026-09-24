import { resolveBaseUrl } from "@lib/baseUrl";

function normalizeOrigin(value: string) {
	const trimmed = value.trim();
	return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).origin;
}

export function getConsentTrustedOrigins(env: NodeJS.ProcessEnv = process.env) {
	const origins = new Set(["https://clipify.us", "https://www.clipify.us", "http://localhost:3000", resolveBaseUrl(env).origin]);

	if (env.NEXT_PUBLIC_BASE_URL) origins.add(normalizeOrigin(env.NEXT_PUBLIC_BASE_URL));

	return [...origins];
}
