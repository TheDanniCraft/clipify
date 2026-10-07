import { createMcpPostgresFixture } from "./postgres";
import type { PoolClient, QueryConfig } from "pg";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const mode = process.argv[2];
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.MCP_ENABLED = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = "isolated-abort-auth-secret-32characters";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-abort-rate-secret-32characters";
	const unrelated: PoolClient[] = [];
	let foreignWork: Promise<boolean> | undefined;
	let injected = 0;
	try {
		await fixture.pool.query("CREATE TABLE fixture_abort_result (id integer PRIMARY KEY)");
		const { dbPool } = await import("@/db/client");
		const query = dbPool.query.bind(dbPool);
		const { withDatabaseRequest } = await import("@/db/request-scope");
		const namedResults: number[] = [];
		for (const value of [7, 8]) {
			const response = await withDatabaseRequest(new AbortController().signal, async () => {
				const client = await dbPool.connect();
				try {
					const result = await client.query({ name: "fixture-owned-query", text: "SELECT $1::integer AS value", values: [value] });
					namedResults.push(result.rows[0].value);
				} finally {
					client.release();
				}
				return Response.json({ ok: true });
			});
			await response.json();
		}

		Object.defineProperty(dbPool, "query", {
			configurable: true,
			value: async (input: string | QueryConfig<unknown[]>, values?: unknown[]) => {
				const text = typeof input === "string" ? input : (input.text ?? "");
				if (!text.includes("information_schema.columns")) return query(input, values);
				const client = await dbPool.connect();
				try {
					await client.query("BEGIN");
					await client.query("SELECT pg_advisory_xact_lock(49115,7202)");
					await client.query("SELECT pg_sleep(4)");
					await client.query("INSERT INTO fixture_abort_result VALUES (1)");
					await client.query("COMMIT");
					throw new Error("Dependency fault fixture");
				} catch (error) {
					await client.query("ROLLBACK").catch(() => {});
					throw error;
				} finally {
					client.release();
				}
			},
		});
		const route = await import("@/app/mcp/route");
		for (let index = 0; index < (mode === "queued" ? 10 : 1); index++) unrelated.push(await dbPool.connect());
		if (mode === "mismatched-backend") {
			const foreignPid = Number((await unrelated[0].query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
			foreignWork = unrelated[0].query("SELECT pg_sleep(2)").then(
				() => true,
				() => false,
			);
			dbPool.on("acquire", (client) => {
				if (client === unrelated[0]) return;
				const native = client.query.bind(client);
				Object.defineProperty(client, "query", {
					configurable: true,
					value: (...args: unknown[]) => {
						const result = Reflect.apply(native, client, args);
						if (args[0] === "SELECT pg_backend_pid() AS pid")
							return Promise.resolve(result).then((value) => {
								injected++;
								return { ...value, rows: [{ pid: foreignPid }] };
							});
						return result;
					},
				});
			});
		}
		const controller = new AbortController();
		const started = performance.now();
		const pending = route.POST(new Request("http://127.0.0.1:3107/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), signal: controller.signal }));
		let reached = false;
		const arrivalDeadline = performance.now() + 2500;
		while (performance.now() < arrivalDeadline) {
			const active = await fixture.pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND query LIKE '%SELECT pg_sleep(4)%' AND query NOT LIKE '%pg_stat_activity%'");
			if (mode === "queued" ? dbPool.waitingCount > 0 : active.rows[0].count > 0) {
				reached = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		const aborted = performance.now();
		controller.abort();
		let elapsedAfterAbort = 0;
		const responseResult = pending.then((response) => {
			elapsedAfterAbort = performance.now() - aborted;
			return response;
		});
		const unrelatedResult = Promise.all(unrelated.map(async (client) => (await client.query("SELECT 7 AS value")).rows[0].value === 7)).then(async (values) => {
			const healthy = values.every(Boolean) && (foreignWork ? await foreignWork : true);
			for (const client of unrelated.splice(0)) client.release();
			return healthy;
		});
		const [response, unrelatedHealthy] = await Promise.all([responseResult, unrelatedResult]);
		const body = await response.json();
		let workReleased = false;
		const cleanupDeadline = performance.now() + 500;
		while (performance.now() < cleanupDeadline) {
			const state = await fixture.pool.query("SELECT pg_try_advisory_xact_lock(49115,7202) AS acquired, (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND query LIKE '%SELECT pg_sleep(4)%' AND query NOT LIKE '%pg_stat_activity%') AS active");
			if (state.rows[0].acquired && state.rows[0].active === 0 && dbPool.waitingCount === 0) {
				workReleased = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		const committed = Number((await fixture.pool.query("SELECT count(*) FROM fixture_abort_result")).rows[0].count);
		Object.defineProperty(dbPool, "query", { configurable: true, value: query });
		const healthy = (await query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		console.log(JSON.stringify({ status: response.status, body, elapsedAfterAbort, reached, workReleased, committed, unrelatedHealthy, healthy, namedResults, injected, elapsed: performance.now() - started }));
	} finally {
		for (const client of unrelated.splice(0)) client.release();
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
