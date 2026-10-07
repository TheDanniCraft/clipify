/** @jest-environment node */
import { runMcpProbe, flowProbe } from "../../support/mcp/probe";
describe("TDD-US4-001/002 real public registration and mutation budgets", () => {
	test("registration stops at the configured budget despite spoofed forwarding headers and persists no rejected client", () => {
		const result = runMcpProbe("registration-rate-probe", []);
		expect(result.results.map((value: any) => value.status)).toEqual([201, 201, 429]);
		expect(result.results[2]).toMatchObject({ error: "rate_limited", registered: false });
		expect(Number(result.results[2].retryAfter)).toBeGreaterThan(0);
		expect(result.clients).toBe(2);
	});
	test("the second public creation call is throttled before any additional mutation", () => {
		const result = flowProbe("resources:overlay-create:rate-limit");
		expect(result.protocolStatus).toBe(200);
		expect(result.toolReplayStatus).toBe(429);
		expect(Number(result.replayRetryAfter)).toBeGreaterThan(0);
		expect(result.resourceCount).toBe(1);
	});
	test("TDD-ACTIVITY-002 authenticated throttling is recorded without private target metadata", () => {
		const result = flowProbe("resources:overlay-create:rate-limit");
		expect(result.toolReplayStatus).toBe(429);
		const denied = result.activityRecords.find((event: any) => event.reason === "RATE_LIMITED");
		expect(denied).toMatchObject({ outcome: "denied", target_id: null, actor_session_id: null });
		expect(denied.metadata).toMatchObject({ tool: "create_overlay" });
		expect(denied.metadata.creatorId).toBeUndefined();
	});
});
