/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-005 provider coordination admission deadline", () => {
	test("timed-out queued work never executes and later admission remains healthy", () => {
		const result = runMcpProbe("provider-queue-probe", [], 30000);
		expect(result.elapsed).toBeGreaterThanOrEqual(9900);
		expect(result.elapsed).toBeLessThan(11000);
		expect(result.error).toBe("PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE");
		expect(result.queuedRuns).toBe(0);
		expect(result.retry).toBe("retry-ok");
		expect(result.healthyWhileHeld).toBe(true);
		expect(result.allLocksReleased).toBe(true);
	});
});
