import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	Object.assign(process.env, { NODE_ENV: "production" });
	process.env.APP_ENV = "test";

	process.env.DISABLE_BACKGROUND_JOBS = "false";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	delete process.env.NEXT_PHASE;
	const legacy = process.argv[2] === "legacy";
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','disabled-cleanup@example.invalid',true,now(),now())`);
		for (const [index, action, age] of [
			[1, "sensitive-integration:mcp.get_overlay", 100],
			[2, "sensitive-integration:mcp.get_overlay", 1],
			[3, "auth.signin", 100],
		] as const)
			await fixture.pool.query("INSERT INTO audit_events (id,actor_user_id,target_type,action,outcome,correlation_id,occurred_at) VALUES ($1,'owner','fixture',$2,'success',$3,now()-($4::text||' days')::interval)", [`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, action, `disabled-${index}`, age]);
		if (legacy) await fixture.pool.query("DROP TABLE mcp_mutation_retries");
		const { startMcpCleanupScheduler } = await import("@/server/mcp/cleanup-scheduler");
		startMcpCleanupScheduler();
		const deadline = performance.now() + 2500;
		while (globalThis.__mcpCleanupSchedulerRunning && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
		const remaining = (await fixture.pool.query("SELECT correlation_id FROM audit_events ORDER BY correlation_id")).rows.map((row) => row.correlation_id);
		const route = await import("@/app/mcp/route");
		const response = await route.GET(new Request("http://127.0.0.1:3107/mcp"));
		const healthy = (await fixture.pool.query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		console.log(JSON.stringify({ remaining, serviceStatus: response.status, healthy, started: !!globalThis.__mcpCleanupSchedulerStarted, finished: !globalThis.__mcpCleanupSchedulerRunning }));
	} finally {
		if (globalThis.__mcpCleanupSchedulerTimer) clearInterval(globalThis.__mcpCleanupSchedulerTimer);
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
