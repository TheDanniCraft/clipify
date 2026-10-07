import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins } from "@/auth/mcp-options";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const origin = "http://127.0.0.1:3107";
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.MCP_ENABLED = "true";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-registration-body-budget-32chars";
	const mode = process.argv[2];
	const abort = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const auth = betterAuth({ baseURL: origin, secret: "isolated-registration-body-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), plugins: createMcpPlugins({ origin, enabled: true }) });
		const metadata = { application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], client_name: mode.startsWith("oversized") ? "x".repeat(262144) : "Body boundary fixture" };
		const bytes = new TextEncoder().encode(JSON.stringify(metadata));
		const headers: Record<string, string> = { "content-type": "application/json" };
		if (mode === "oversized-declared") headers["content-length"] = String(bytes.byteLength);
		let body: string | ReadableStream<Uint8Array> = new TextDecoder().decode(bytes);
		if (mode === "deadline" || mode === "cancel" || mode === "oversized-chunked")
			body = new ReadableStream({
				start(controller) {
					if (mode === "oversized-chunked") {
						controller.enqueue(bytes);
						controller.close();
						return;
					}
					controller.enqueue(bytes.subarray(0, 20));
					timer = setTimeout(
						() => {
							try {
								controller.enqueue(bytes.subarray(20));
								controller.close();
							} catch {}
						},
						mode === "deadline" ? 12000 : 2000,
					);
				},
			});
		const request = new Request(origin + "/api/auth/oauth2/register", { method: "POST", headers, body, signal: abort.signal, ...(typeof body === "string" ? {} : { duplex: "half" }) });
		let cancelTimer: ReturnType<typeof setTimeout> | undefined;
		if (mode === "cancel") cancelTimer = setTimeout(() => abort.abort(), 100);
		const started = performance.now();
		const response = await auth.handler(request);
		const elapsed = performance.now() - started;
		if (cancelTimer) clearTimeout(cancelTimer);
		const count = Number((await fixture.pool.query("SELECT count(*) FROM auth.oauth_client")).rows[0].count);
		console.log(JSON.stringify({ status: response.status, body: response.ok ? null : await response.json(), elapsed, clients: count }));
	} finally {
		if (timer) clearTimeout(timer);
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
