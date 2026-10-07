import { jwt } from "better-auth/plugins";
import { mcp, type McpOptions } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import type { BetterAuthPlugin } from "better-auth";

import { MCP_SCOPES } from "@/server/mcp/scopes";
export { MCP_SCOPES } from "@/server/mcp/scopes";

function validCallback(value: unknown): boolean {
	if (typeof value !== "string" || value.includes("*")) return false;
	try {
		const url = new URL(value);
		return !url.username && !url.password && !url.hash && (url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)));
	} catch {
		return false;
	}
}

/** Bound DNS/header waits; the provider retains its own bounded metadata body validation. */
const boundedClientMetadataFetch: typeof fetchClientMetadataResource = async (input, init) => {
	const controller = new AbortController();
	const parent = init?.signal ?? (input instanceof Request ? input.signal : undefined);
	let interrupt!: (error: Error) => void;
	const interrupted = new Promise<never>((_, reject) => {
		interrupt = reject;
	});
	const stop = () => {
		interrupt(new Error("METADATA_FETCH_UNAVAILABLE"));
		controller.abort();
	};
	parent?.addEventListener("abort", stop, { once: true });
	const timer = setTimeout(stop, 10000);
	try {
		if (parent?.aborted) throw new Error("METADATA_FETCH_UNAVAILABLE");
		const response = await Promise.race([fetchClientMetadataResource(input, { ...init, signal: controller.signal }), interrupted]);
		// The provider rejects these responses before acquiring their body reader.
		if (response.status !== 304 && (response.status !== 200 || !/^application\/(?:[-\w.]+\+)?json\s*(?:;|$)/i.test(response.headers.get("content-type") ?? ""))) void response.body?.cancel().catch(() => {});
		return response;
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener("abort", stop);
	}
};

const MAX_REGISTRATION_BYTES = 256 * 1024;

async function readRegistrationBody(request: Request): Promise<Uint8Array> {
	const declared = request.headers.get("content-length");
	if (!request.body || request.signal.aborted || (declared && /^\d+$/.test(declared) && Number(declared) > MAX_REGISTRATION_BYTES)) {
		void request.body?.cancel().catch(() => {});
		throw new Error("INVALID_REGISTRATION_BODY");
	}
	const reader = request.body.getReader();
	let interrupt!: (error: Error) => void;
	const interrupted = new Promise<never>((_, reject) => {
		interrupt = reject;
	});
	const stop = () => {
		interrupt(new Error("INVALID_REGISTRATION_BODY"));
		void reader.cancel().catch(() => {});
	};
	request.signal.addEventListener("abort", stop, { once: true });
	const timer = setTimeout(stop, 10000);
	let complete = false;
	try {
		if (request.signal.aborted) stop();
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const next = await Promise.race([reader.read(), interrupted]);
			if (next.done) break;
			size += next.value.byteLength;
			if (size > MAX_REGISTRATION_BYTES) throw new Error("INVALID_REGISTRATION_BODY");
			chunks.push(next.value);
		}
		if (request.signal.aborted) throw new Error("INVALID_REGISTRATION_BODY");
		complete = true;
		return Buffer.concat(chunks, size);
	} finally {
		clearTimeout(timer);
		request.signal.removeEventListener("abort", stop);
		if (!complete) void reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

// Registration grants identity only. Keep third-party callbacks out of trustedOrigins.
const registrationBoundary: BetterAuthPlugin = {
	id: "clipify-mcp-registration",
	onRequest: async (request) => {
		if (!new URL(request.url).pathname.endsWith("/oauth2/register") || request.method !== "POST") return;
		try {
			const { consumeMcpRateLimit, getMcpNetworkSignal, getMcpRateLimits } = await import("@/server/mcp/rate-limit");
			const decision = await consumeMcpRateLimit({ kind: "registration", network: getMcpNetworkSignal(request), limits: getMcpRateLimits() });
			if (!decision.allowed) return { response: Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }) };
		} catch {
			return { response: Response.json({ error: "temporarily_unavailable" }, { status: 503 }) };
		}
		let body: Record<string, unknown>;
		let bytes: Uint8Array;
		try {
			bytes = await readRegistrationBody(request);
			body = JSON.parse(new TextDecoder().decode(bytes));
		} catch {
			return { response: Response.json({ error: "invalid_client_metadata" }, { status: 400 }) };
		}
		if (!body || typeof body !== "object" || Array.isArray(body)) return { response: Response.json({ error: "invalid_client_metadata" }, { status: 400 }) };
		const valid = Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0 && body.redirect_uris.length <= 10 && body.redirect_uris.every(validCallback) && (!body.grant_types || (Array.isArray(body.grant_types) && body.grant_types.every((value) => ["authorization_code", "refresh_token"].includes(value)))) && (!body.scope || (typeof body.scope === "string" && body.scope.split(" ").every((scope) => [...MCP_SCOPES, "offline_access"].includes(scope as (typeof MCP_SCOPES)[number]))));
		if (!valid) return { response: Response.json({ error: "invalid_client_metadata" }, { status: 400 }) };
		return { request: new Request(request, { body: Buffer.from(bytes) }) };
	},
};

export function createMcpPlugins(input: { origin: string; enabled: boolean; options?: Partial<McpOptions> }): BetterAuthPlugin[] {
	if (!input.enabled) return [];
	const origin = new URL(input.origin).origin;
	return [
		registrationBoundary,
		jwt({ jwt: { issuer: `${origin}/api/auth` } }),
		mcp({ ...input.options, loginPage: "/auth/mcp/consent", consentPage: "/auth/mcp/consent", resource: `${origin}/mcp`, scopes: [...MCP_SCOPES, "offline_access"], grantTypes: ["authorization_code", "refresh_token"], refreshTokenReuseInterval: 0, allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true }),
		cimd({ fetchClientMetadataResource: boundedClientMetadataFetch, metadataProfile: "mcp-2026-07-28" }),
	];
}
