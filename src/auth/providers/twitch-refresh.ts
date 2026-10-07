import "server-only";
import { refreshAccessTokenRequest, getOAuth2Tokens } from "@better-auth/core/oauth2";
import { requiredAuthSetting } from "../environment";

const MAX_REFRESH_RESPONSE_BYTES = 64 * 1024;

async function readRefreshTokens(response: Response) {
	const declared = response.headers.get("content-length");
	if (!response.body || (declared && /^\d+$/.test(declared) && Number(declared) > MAX_REFRESH_RESPONSE_BYTES)) {
		void response.body?.cancel().catch(() => {});
		throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let complete = false;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			size += next.value.byteLength;
			if (size > MAX_REFRESH_RESPONSE_BYTES) throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
			chunks.push(next.value);
		}
		complete = true;
	} finally {
		if (!complete) void reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	const data: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks, size)));
	if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
	const tokens = data as Record<string, unknown>;
	const validToken = (value: unknown) => typeof value === "string" && value.length > 0 && value.trim() === value;
	const expiry = tokens.expires_in;
	if (!validToken(tokens.access_token) || (tokens.refresh_token !== undefined && !validToken(tokens.refresh_token)) || typeof expiry !== "number" || !Number.isSafeInteger(expiry) || expiry <= 0 || !Number.isFinite(new Date(Date.now() + expiry * 1000).getTime())) throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
	return getOAuth2Tokens(tokens);
}

/** Bound the entire token exchange, including response consumption; Better Auth retains encrypted persistence. */
export async function refreshTwitchAccessToken(refreshToken: string) {
	const controller = new AbortController();
	let rejectDeadline!: (error: Error) => void;
	const deadline = new Promise<never>((_, reject) => {
		rejectDeadline = reject;
	});
	const timer = setTimeout(() => {
		rejectDeadline(new Error("PROVIDER_REFRESH_UNAVAILABLE"));
		controller.abort();
	}, 10000);
	try {
		const exchange = async () => {
			const endpoint = "https://id.twitch.tv/oauth2/token";
			const { body, headers } = await refreshAccessTokenRequest({ refreshToken, tokenEndpoint: endpoint, options: { clientId: requiredAuthSetting("TWITCH_CLIENT_ID"), clientSecret: requiredAuthSetting("TWITCH_CLIENT_SECRET") } });
			const response = await fetch(endpoint, { method: "POST", body, headers, redirect: "error", signal: controller.signal });
			if (!response.ok) throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
			return readRefreshTokens(response);
		};
		return await Promise.race([exchange(), deadline]);
	} catch {
		throw new Error("PROVIDER_REFRESH_UNAVAILABLE");
	} finally {
		clearTimeout(timer);
	}
}
