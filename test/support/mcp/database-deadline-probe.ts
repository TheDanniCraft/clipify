import { createServer, type Socket } from "node:net";
import { createMcpPostgresFixture } from "./postgres";
import type { QueryConfig } from "pg";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const mode = process.argv[2];
	const sockets = new Set<Socket>();
	const blackhole = createServer((socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.MCP_ENABLED = "true";
	process.env.BASE_URL = "http://127.0.0.1:3107";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = "isolated-dependency-auth-secret-32characters";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-dependency-rate-secret-32characters";
	let watchdog: ReturnType<typeof setTimeout> | undefined;
	try {
		if (mode === "connection") {
			await new Promise<void>((resolve) => blackhole.listen(0, "127.0.0.1", resolve));
			const address = blackhole.address();
			if (!address || typeof address === "string") throw new Error("No isolated address");
			const url = new URL(fixture.url);
			url.port = String(address.port);
			process.env.DATABASE_URL = url.toString();
		}
		const { dbPool } = await import("@/db/client");
		const query = dbPool.query.bind(dbPool);
		const codes: string[] = [];
		if (mode === "statement")
			Object.defineProperty(dbPool, "query", {
				configurable: true,
				value: async (input: string | QueryConfig<unknown[]>, values?: unknown[]) => {
					const text = typeof input === "string" ? input : (input.text ?? "");
					if (text.includes("information_schema.columns")) {
						try {
							return await query("BEGIN; SELECT pg_advisory_xact_lock(49115,7201); SELECT pg_sleep(12)");
						} catch (error) {
							if (error && typeof error === "object" && "code" in error) codes.push(String(error.code));
							throw error;
						}
					}
					return query(input, values);
				},
			});
		const route = await import("@/app/mcp/route");
		if (mode === "connection")
			watchdog = setTimeout(() => {
				for (const socket of sockets) socket.destroy();
			}, 14000);
		const started = performance.now();
		const response = await route.POST(new Request("http://127.0.0.1:3107/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
		const elapsed = performance.now() - started;
		const body = await response.json();
		Object.defineProperty(dbPool, "query", { configurable: true, value: query });
		let workReleased: boolean,
			healthy = false;
		if (mode === "statement") {
			const lock = await fixture.pool.query("SELECT pg_try_advisory_xact_lock(49115,7201) AS acquired");
			const running = await fixture.pool.query("SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active' AND query LIKE '%pg_sleep(12)%'");
			workReleased = lock.rows[0].acquired && running.rows[0].active === 0;
			healthy = (await query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		} else workReleased = dbPool.totalCount === 0 && dbPool.waitingCount === 0;
		console.log(JSON.stringify({ status: response.status, body, elapsed, workReleased, healthy, codes }));
	} finally {
		if (watchdog) clearTimeout(watchdog);
		for (const socket of sockets) socket.destroy();
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		if (blackhole.listening) await new Promise<void>((resolve) => blackhole.close(() => resolve()));
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
