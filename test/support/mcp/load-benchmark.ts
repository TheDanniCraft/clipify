import { randomUUID } from "node:crypto";
import { cpus, totalmem } from "node:os";
import type { Pool } from "pg";
type Target = { creatorId: string; overlayId: string };
export async function seedBenchmarkCreators(pool: Pool, actorId: string): Promise<Target[]> {
	const targets: Target[] = [];
	for (let i = 0; i < 20; i++) {
		const creatorId = i === 0 ? "fixture-creator" : `benchmark-creator-${i}`;
		if (i > 0) {
			const organizationId = `benchmark-org-${i}`;
			await pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES($1,$1,$1,now())", [organizationId]);
			await pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,$1,'','user','free')", [creatorId, creatorId + "@example.invalid"]);
			await pool.query("INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES($1,$2,'active')", [creatorId, organizationId]);
			await pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,$2,$3,'owner',now())", [randomUUID(), organizationId, actorId]);
		}
		const overlayId = randomUUID();
		await pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'isolated-benchmark-secret','Benchmark overlay','active','Featured')", [overlayId, creatorId]);
		targets.push({ creatorId, overlayId });
	}
	return targets;
}
export async function runLoadBenchmark(pool: Pool, targets: Target[], token: string, origin: string, auth: { handler: (request: Request) => Promise<Response> }) {
	const { POST } = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	let unexpectedNetworkCalls = 0;
	let localAuthorizationRequests = 0;
	globalThis.fetch = async (input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		if (new URL(request.url).origin === origin) {
			localAuthorizationRequests++;
			return auth.handler(request);
		}
		unexpectedNetworkCalls++;
		throw new Error("UNEXPECTED_BENCHMARK_NETWORK");
	};
	try {
		let id = 0;
		const invoke = async (target: Target, mutation: boolean, revision: number) => {
			const started = performance.now();
			const response = await POST(
				new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name: mutation ? "update_overlay" : "get_overlay", arguments: mutation ? { ...target, expectedRevision: revision, patch: { name: `Benchmark revision ${revision + 1}` } } : target } }) }),
			);
			const raw = await response.text();
			const data =
				raw.startsWith("event:") || raw.startsWith("data:")
					? raw
							.split("\n")
							.find((line) => line.startsWith("data:"))
							?.slice(5)
							.trim()
					: raw;
			const result = data ? JSON.parse(data) : null;
			if (response.status !== 200 || result?.result?.isError || !result?.result?.structuredContent?.overlay) throw new Error(`BENCHMARK_CALL_FAILED:${response.status}:${result?.result?.structuredContent?.error?.code ?? result?.error?.code ?? "missing-overlay"}`);
			const overlay = result.result.structuredContent.overlay;
			if (overlay.id !== target.overlayId || overlay.creatorId !== target.creatorId || overlay.configurationRevision !== (mutation ? revision + 1 : revision)) throw new Error("BENCHMARK_RESULT_MISMATCH");
			if (raw.includes("isolated-benchmark-secret")) throw new Error("BENCHMARK_PRIVATE_DATA_DISCLOSED");
			return performance.now() - started;
		};
		await Promise.all(targets.map((target) => invoke(target, false, 1)));
		await Promise.all(targets.map((target) => invoke(target, true, 1)));
		const reads = await Promise.all(targets.map((target) => invoke(target, false, 2)));
		const mutations = await Promise.all(targets.map((target) => invoke(target, true, 2)));
		const percentile = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
		const rows = (await pool.query("SELECT configuration_revision,count(*)::int AS count FROM overlays GROUP BY configuration_revision")).rows;
		const budget = (await pool.query("SELECT count FROM rate_limit_counters WHERE action='mcp:call:actor-client'")).rows.map((row) => row.count);
		return {
			settings: { concurrency: 20, independentCreators: new Set(targets.map((target) => target.creatorId)).size, warmupCalls: 40, measuredCalls: 40, samplesPerOperation: 20, poolMax: (await import("@/db/client")).dbPool.options.max, node: process.version, cpuCount: cpus().length, memoryBytes: totalmem(), transport: "actual Node Web Request/Response route", externalLatency: "no external calls; fixture/setup and warmup excluded", percentile: "nearest-rank ceil(n*0.95)-1" },
			readsMs: reads,
			mutationsMs: mutations,
			p95ReadMs: percentile(reads),
			p95MutationMs: percentile(mutations),
			rows,
			budget,
			unexpectedNetworkCalls,
			localAuthorizationRequests,
		};
	} finally {
		globalThis.fetch = originalFetch;
	}
}
