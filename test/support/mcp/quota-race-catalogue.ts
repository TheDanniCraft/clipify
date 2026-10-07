import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import type { createMcpPostgresFixture } from "./postgres";

/** Real browser session actions and bearer-authenticated HTTP calls share one PostgreSQL creator. */
export async function runQuotaRaceCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: { handler: (request: Request) => Promise<Response> }; origin: string; token: string; cookie: string; mode: string }) {
	const { fixture, origin } = input;
	if (!["browser", "mcp", "mixed"].includes(input.mode)) throw new Error("Invalid quota race fixture mode");
	const { RequestCookies } = createRequire(process.cwd() + "/package.json")("next/dist/compiled/@edge-runtime/cookies");
	const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
	Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
	const headers = new Headers({ Cookie: input.cookie, Origin: origin });
	const actions = await import("@/app/actions/database");
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("QUOTA_RACE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		const outcomes = await Promise.all(
			Array.from({ length: 20 }, async (_, index) => {
				const browser = input.mode === "browser" || (input.mode === "mixed" && index < 10);
				if (browser) {
					const result = await storage.run({ headers, cookies: new RequestCookies(headers) }, () => actions.createOverlayWithFeedback("fixture-creator"));
					return { source: "browser", status: 200, success: Boolean(result.overlay), code: result.error?.code ?? null };
				}
				const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: index + 1, method: "tools/call", params: { name: "create_overlay", arguments: { creatorId: "fixture-creator", retryKey: `quota-race-${index}`, name: "Quota race overlay" } } }) }));
				const wire = await response.text();
				const text =
					wire.startsWith("event:") || wire.startsWith("data:")
						? wire
								.split("\n")
								.find((line) => line.startsWith("data:"))
								?.slice(5)
								.trim()
						: wire;
				const result = text ? JSON.parse(text)?.result : undefined;
				return { source: "mcp", status: response.status, success: response.ok && Boolean(result) && !result.isError, code: result?.structuredContent?.error?.code ?? null };
			}),
		);
		const resources = Number((await fixture.pool.query("SELECT count(*) FROM overlays WHERE owner_id='fixture-creator'")).rows[0].count);
		return { mode: input.mode, outcomes, resources, successes: outcomes.filter((row) => row.success).length, denials: outcomes.filter((row) => !row.success).map((row) => row.code), browserRequests: outcomes.filter((row) => row.source === "browser").length, mcpRequests: outcomes.filter((row) => row.source === "mcp").length };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
