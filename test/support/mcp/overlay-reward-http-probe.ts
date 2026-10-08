import { createServer } from "node:http";
async function main() {
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.TWITCH_CLIENT_ID = "isolated-reward-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-reward-client-secret";
	process.env.WEBHOOK_SECRET = "isolated-reward-webhook-secret";
	process.env.TWITCH_EVENTSUB_URL = "https://fixture.example.invalid/eventsub";
	const mode = process.argv[2];
	process.env.IS_PREVIEW = mode === "preview" ? "true" : "false";
	process.env.NEXT_PUBLIC_BASE_URL = "https://preview.example.invalid";
	const expectedCallback = mode === "preview" ? "https://preview.example.invalid/eventsub" : process.env.TWITCH_EVENTSUB_URL;
	if (mode === "missing-client") delete process.env.TWITCH_CLIENT_ID;
	if (mode === "missing-secret") delete process.env.TWITCH_CLIENT_SECRET;
	if (mode === "missing-webhook") delete process.env.WEBHOOK_SECRET;
	if (mode === "missing-callback") delete process.env.TWITCH_EVENTSUB_URL;
	if (mode === "bad-callback") process.env.TWITCH_EVENTSUB_URL = "http://fixture.example.invalid/eventsub";
	if (mode === "bad-webhook") process.env.WEBHOOK_SECRET = "short";

	const calls: { path: string; valid: boolean }[] = [];
	const server = createServer(async (request, response) => {
		let text = "";
		for await (const chunk of request) text += chunk;
		response.setHeader("Content-Type", "application/json");
		function respondToAppTokenRequest() {
			if (request.url === "/oauth2/token") {
				const form = new URLSearchParams(text);
				calls.push({ path: "token", valid: request.method === "POST" && form.get("client_id") === process.env.TWITCH_CLIENT_ID && form.get("client_secret") === process.env.TWITCH_CLIENT_SECRET && form.get("grant_type") === "client_credentials" });
				if (mode === "token-headers") return true;
				if (mode === "token-body") {
					response.writeHead(200);
					response.write('{"access_token":');
					return true;
				}
				response.statusCode = mode === "app-auth" ? 401 : 200;
				response.end(mode === "invalid-json" ? "invalid" : mode === "missing-token" ? "{}" : mode === "token-array" ? "[]" : mode === "oversized-token" ? JSON.stringify({ access_token: "x".repeat(65536), token_type: "bearer", expires_in: 3600 }) : JSON.stringify({ access_token: mode === "bad-token" ? " whitespace " : "isolated-app-token", token_type: mode === "bad-token-type" ? "other" : "bearer", expires_in: mode === "bad-expiry" ? 0 : 3600 }));
				return true;
			}
		}
		if (respondToAppTokenRequest()) return;
		function respondToSubscriptionRequest() {
			if (request.url === "/helix/eventsub/subscriptions") {
				const body = JSON.parse(text);
				calls.push({
					path: "subscription",
					valid:
						request.method === "POST" &&
						request.headers.authorization === "Bearer isolated-app-token" &&
						request.headers["client-id"] === process.env.TWITCH_CLIENT_ID &&
						body.type === "channel.channel_points_custom_reward_redemption.add" &&
						body.version === "1" &&
						body.condition?.broadcaster_user_id === "creator" &&
						body.condition?.reward_id === "RewardOne" &&
						body.transport?.method === "webhook" &&
						body.transport?.callback === expectedCallback &&
						body.transport?.secret === process.env.WEBHOOK_SECRET,
				});
				if (mode === "subscription-headers") return true;
				response.statusCode = mode === "exists" ? 409 : mode === "rate" ? 429 : mode === "denied" ? 403 : 202;
				response.end(JSON.stringify({ data: [] }));
				return true;
			}
		}
		if (respondToSubscriptionRequest()) return;
		throw new Error("Unexpected reward fixture path");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Fixture listener unavailable");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(input, init);
		const url = new URL(request.url);
		if (!((url.origin === "https://id.twitch.tv" && url.pathname === "/oauth2/token") || (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/eventsub/subscriptions"))) throw new Error("Unexpected external reward fixture I/O");
		return originalFetch(new Request(`http://127.0.0.1:${address.port}${url.pathname}`, request));
	}) as typeof fetch;
	try {
		const effects = await import("@/server/resources/overlay-effects");
		const subscribe = (effects as any).subscribeOverlayReward;
		const started = performance.now();
		let success = false;
		let error: string | null = null;
		if (typeof subscribe === "function") {
			try {
				await subscribe("creator", "RewardOne");
				success = true;
			} catch (failure) {
				error = failure instanceof Error ? failure.message : "unexpected";
			}
		}
		console.log(JSON.stringify({ available: typeof subscribe === "function", mode, success, error, calls, elapsedMs: performance.now() - started }));
	} finally {
		globalThis.fetch = originalFetch;
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		await (await import("@/db/client")).dbPool.end();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
