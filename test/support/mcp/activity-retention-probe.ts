import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const mode = process.argv[2];
	const now = new Date("2026-10-05T00:00:00Z");
	delete process.env.MCP_ACTIVITY_RETENTION_DAYS;
	if (mode === "configured") process.env.MCP_ACTIVITY_RETENTION_DAYS = "1";
	if (mode === "invalid-config") process.env.MCP_ACTIVITY_RETENTION_DAYS = "unbounded";
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('retention-owner','Owner','retention@example.invalid',true,$1,$1)`, [now]);
		const cutoff = now.getTime() - (mode === "configured" ? 1 : 90) * 86400000;
		for (const [index, action, time] of [
			[1, "sensitive-integration:mcp.get_overlay", cutoff - 1],
			[2, "sensitive-integration:mcp.unavailable_tool", cutoff],
			[3, "sensitive-integration:mcp.create_playlist", cutoff + 1],
			[4, "billing.subscription.update", cutoff - 1],
			[5, "auth.signin", cutoff - 1],
			[6, "sensitive-integration:mcp-other", cutoff - 1],
		] as const) {
			await fixture.pool.query("INSERT INTO audit_events (id,actor_user_id,target_type,action,outcome,correlation_id,occurred_at) VALUES ($1,'retention-owner','fixture',$2,'success',$3,$4)", [`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, action, `retention-${index}`, new Date(time)]);
		}
		const service = await import("@/server/mcp/cleanup");
		const prune = (service as typeof service & { pruneMcpActivity?: (input: { now: Date; batchSize: number }, client: typeof fixture.db) => Promise<unknown> }).pruneMcpActivity;
		let result: unknown = null;
		let error: string | null = null;
		try {
			if (prune) result = mode === "concurrent" ? await Promise.all([prune({ now, batchSize: 1 }, fixture.db), prune({ now, batchSize: 1 }, fixture.db)]) : await prune({ now, batchSize: mode === "bounded" ? 1 : 100 }, fixture.db);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "unknown";
		}
		const remaining = (await fixture.pool.query("SELECT correlation_id FROM audit_events ORDER BY correlation_id")).rows.map((row) => row.correlation_id);
		console.log(JSON.stringify({ available: !!prune, result, error, remaining }));
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
