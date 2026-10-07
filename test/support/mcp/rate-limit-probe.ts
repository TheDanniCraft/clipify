import { existsSync } from "node:fs";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-rate-limit-hmac-secret-32chars";
	try {
		const service = existsSync("src/server/mcp/rate-limit.ts") ? await import("@/server/mcp/rate-limit") : null;
		if (!service) {
			console.log(JSON.stringify({ available: false }));
		} else {
			const mode = process.argv[2],
				now = new Date("2026-10-05T00:00:00Z");
			const input = { kind: "call" as const, authUserId: "actor-one", clientId: "client-one", network: "127.0.0.1", now, limits: { callsPerMinute: 3, callsPerNetworkMinute: 6 } };
			const consume = (patch: Record<string, unknown> = {}) => service.consumeMcpRateLimit({ ...input, ...patch }, fixture.db);
			let results: unknown[] = [];
			if (mode === "boundary") for (let i = 0; i < 4; i++) results.push(await consume());
			if (mode === "reset") {
				for (let i = 0; i < 3; i++) await consume();
				results = [await consume({ now: new Date(now.getTime() + 59999) }), await consume({ now: new Date(now.getTime() + 60000) })];
			}
			if (mode === "concurrent") results = await Promise.all(Array.from({ length: 20 }, () => consume()));
			if (mode === "identity") {
				for (let i = 0; i < 3; i++) await consume();
				results = [await consume({ authUserId: "actor-two" }), await consume({ clientId: "client-two" }), await consume()];
			}
			if (mode === "network") {
				for (let i = 0; i < 6; i++) await consume({ authUserId: `actor-${i}` });
				results = [await consume({ authUserId: "actor-seven" }), await consume({ network: "127.0.0.2", authUserId: "actor-seven" })];
			}
			if (mode === "registration") {
				const registration = { kind: "registration", network: "127.0.0.1", now, limits: { registrationsPerMinute: 2, registrationsPerDay: 3 } };
				results = [await consume(registration), await consume(registration), await consume(registration), await consume({ ...registration, now: new Date(now.getTime() + 60000) }), await consume({ ...registration, now: new Date(now.getTime() + 120000) })];
			}
			if (mode === "missing-secret") {
				delete process.env.RATE_LIMIT_HASH_SECRET;
				try {
					await consume();
					results = ["unexpected-success"];
				} catch {
					results = ["unavailable"];
				}
			}
			if (mode === "database-failure") {
				await fixture.pool.query("DROP TABLE rate_limit_counters");
				try {
					await consume();
					results = ["unexpected-success"];
				} catch {
					results = ["unavailable"];
				}
			}
			const counters = mode === "database-failure" ? [] : (await fixture.pool.query("SELECT action,signal_type,signal_hash,count FROM rate_limit_counters ORDER BY action,signal_type,signal_hash")).rows;
			console.log(JSON.stringify({ available: true, results, counters }));
		}
	} finally {
		if (existsSync("src/server/mcp/rate-limit.ts")) {
			const { dbPool } = await import("@/db/client");
			await dbPool.end();
		}
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
