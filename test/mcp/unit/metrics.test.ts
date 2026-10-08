/** @jest-environment node */
import { createMcpMetricsStore } from "@/server/mcp/metrics";

test("bounded immutable cumulative counters record each completion once and classify real outcomes", () => {
	let now = 0;
	const metrics = createMcpMetricsStore({ now: () => now, startedAt: "2026-10-08T00:00:00.000Z", instanceId: "fixture" });
	const finish = metrics.startCall("get_overlay");
	expect(metrics.snapshot().calls.inFlight).toBe(1);
	now = 100;
	finish("success");
	finish("error", "SERVICE_UNAVAILABLE");
	const snapshot = metrics.snapshot();
	expect(snapshot.calls).toMatchObject({ started_total: 1, completed_total: 1, success_total: 1, error_total: 0, inFlight: 0 });
	expect(snapshot.duration).toMatchObject({ count: 1, seconds_sum: 0.1 });
	expect(snapshot.duration.buckets.le_0_1_total).toBe(1);
	snapshot.calls.success_total = 999;
	expect(metrics.snapshot().calls.success_total).toBe(1);
	expect(metrics.snapshot().processStartedAt).toBe("2026-10-08T00:00:00.000Z");
});
test("unknown tool/reason labels stay bounded and histogram boundaries are inclusive", () => {
	let now = 0;
	const metrics = createMcpMetricsStore({ now: () => now });
	for (let i = 0; i < 100; i++) {
		const finish = metrics.startCall(`attacker-${i}`);
		now += 250;
		finish("denied", `raw secret ${i}`);
	}
	const s = metrics.snapshot();
	expect(Object.keys(s.tools).filter((x) => x.startsWith("attacker"))).toHaveLength(0);
	expect(s.tools.unknown.denied_total).toBe(100);
	expect(s.reasons.other_total).toBe(100);
	expect(s.duration.buckets.le_0_1_total).toBe(0);
	expect(s.duration.buckets.le_0_25_total).toBe(100);
	expect(s.duration.buckets.le_inf_total).toBe(100);
	expect(JSON.stringify(s)).not.toContain("raw secret");
});
test("concurrent calls, cancellations, discovery and HTTP outcomes remain separate", () => {
	const metrics = createMcpMetricsStore();
	const a = metrics.startCall("get_overlay"),
		b = metrics.startCall("create_overlay");
	b("cancelled");
	a("denied", "MISSING_SCOPE");
	metrics.recordRequest("POST", 401);
	metrics.recordRequest("invalid-method", 503);
	metrics.recordOperation("tools/list");
	metrics.recordOperation("prompts/get");
	metrics.recordOperation("untrusted");
	const s = metrics.snapshot();
	expect(s.calls.inFlight).toBe(0);
	expect(s.calls.cancelled_total).toBe(1);
	expect(s.reasons.MISSING_SCOPE_total).toBe(1);
	expect(s.requests).toMatchObject({ total: 2, POST_total: 1, other_total: 1, status_4xx_total: 1, status_5xx_total: 1 });
	expect(s.operations).toMatchObject({ tools_list_total: 1, prompts_get_total: 1, other_total: 1 });
	expect(s.categories.write.started_total).toBe(1);
	expect(s.categories.read.started_total).toBe(1);
});
