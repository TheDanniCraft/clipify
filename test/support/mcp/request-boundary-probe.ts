import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";

	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = "isolated-request-boundary-secret-32chars";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-request-budget-secret-32chars";
	for (const name of Object.keys(process.env)) if (name.startsWith("COOLIFY_")) delete process.env[name];
	try {
		const route = await import("@/app/mcp/route");
		const mode = process.argv[2];
		const method = mode === "preflight" ? "OPTIONS" : mode === "get" ? "GET" : mode === "delete" ? "DELETE" : "POST";
		const headers = new Headers({ "Content-Type": "application/json", Origin: "http://127.0.0.1:3107", Host: mode === "bad-host" ? "evil.example.invalid" : "127.0.0.1:3107" });
		if (mode === "preflight") headers.set("Access-Control-Request-Headers", "authorization,content-type,mcp-protocol-version,mcp-method,mcp-name");
		let body: BodyInit | undefined = method === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_creators", arguments: {} } }) : undefined;
		if (mode === "oversized") body = " ".repeat(256 * 1024 + 1);
		if (mode === "exact-limit") body = " ".repeat(256 * 1024);
		if (mode === "stream-overflow")
			body = new ReadableStream({
				start(controller) {
					controller.enqueue(new Uint8Array(256 * 1024));
					controller.enqueue(new Uint8Array(1));
				},
				cancel() {},
			});
		const abort = new AbortController();
		let cancelled = false;
		let streamController: ReadableStreamDefaultController | undefined;
		const stalled = mode === "aborted-body" || mode === "stalled-body";
		if (stalled)
			body = new ReadableStream({
				start(controller) {
					streamController = controller;
					controller.enqueue(new Uint8Array([123]));
				},
				cancel() {
					cancelled = true;
				},
			});
		const request = new Request(mode === "framework-url" ? "http://localhost:3107/mcp" : "http://127.0.0.1:3107/mcp", { method, headers, signal: abort.signal, ...(body ? { body, duplex: "half" } : {}) } as RequestInit);
		const pending = route[method as "POST" | "GET" | "DELETE" | "OPTIONS"](request);
		const abortTimer = mode === "aborted-body" ? setTimeout(() => abort.abort(), 10) : undefined;
		let guard: ReturnType<typeof setTimeout> | undefined;
		const result = stalled
			? await Promise.race([
					pending,
					new Promise<Response>((resolve) => {
						guard = setTimeout(() => resolve(Response.json({ boundaryDidNotSettle: true }, { status: 504 })), mode === "stalled-body" ? 11000 : 500);
					}),
				])
			: await pending;
		if (guard) clearTimeout(guard);
		if (abortTimer) clearTimeout(abortTimer);
		if (stalled && !cancelled) {
			streamController!.close();
			await pending;
		}

		console.log(JSON.stringify({ status: result.status, cancelled, headers: Object.fromEntries(result.headers), body: await result.json().catch(() => null) }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
