import { resolveBaseUrl } from "@/app/lib/baseUrl";

function approvedOrigin(value: string): URL | null {
	try {
		const url = new URL(value);
		const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.hostname.includes("*") || url.pathname !== "/" || url.search || url.hash) return null;
		return url;
	} catch {
		return null;
	}
}

/** MCP is always installed; unusable identities, keys or origins fail closed. */
export function getMcpConfiguration(environment: NodeJS.ProcessEnv = process.env) {
	let origin = "https://clipify.us",
		valid = true;
	try {
		const base = resolveBaseUrl(environment);
		const approved = approvedOrigin(base.href);
		if (!approved) valid = false;
		else origin = approved.origin;
	} catch {
		valid = false;
	}
	const resource = `${origin}/mcp`,
		issuer = `${origin}/api/auth`;
	const allowedOrigins = [origin];
	const authSecret = environment.BETTER_AUTH_SECRET ?? environment.JWT_SECRET;
	if (!authSecret || authSecret.trim().length < 32 || !environment.RATE_LIMIT_HASH_SECRET || environment.RATE_LIMIT_HASH_SECRET.trim().length < 32) valid = false;
	return { valid, origin, resource, issuer, allowedOrigins };
}
