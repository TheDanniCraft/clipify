/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-CANCELLATION-001 request-owned database work", () => {
	test.each(["busy", "queued", "mismatched-backend"])("%s request abort stops work without unrelated lease cancellation", (mode) => {
		const result = runMcpProbe("database-abort-probe", [mode]);
		expect(result.reached).toBe(true);
		expect(result.status).toBe(400);
		expect(result.body).toEqual({ error: "invalid_request" });
		expect(result.elapsedAfterAbort).toBeLessThan(1000);
		expect(result.workReleased).toBe(true);
		expect(result.committed).toBe(0);
		expect(result.unrelatedHealthy).toBe(true);
		expect(result.healthy).toBe(true);
		expect(result.namedResults).toEqual([7, 8]);
	});
});
