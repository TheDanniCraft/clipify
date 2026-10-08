/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-003 provider credential pool starvation", () => {
	test("twenty simultaneous cached credential reads leave room for actual Better Auth storage", () => {
		const result = runMcpProbe("provider-concurrency-probe", [], 60000);
		expect(result.successes).toBe(20);
		expect(result.failures).toBe(0);
		expect(result.elapsed).toBeLessThan(5000);
		expect(result.reads).toBe(20);
		expect(result.lockReleased).toBe(true);
		expect(result.healthy).toBe(true);
	});
	test("insufficient coordination capacity fails before holding the only connection", () => {
		const result = runMcpProbe("provider-concurrency-probe", ["capacity-one"], 30000);
		expect(result.successes).toBe(0);
		expect(result.failures).toBe(1);
		expect(result.capacityRejected).toBe(true);
		expect(result.elapsed).toBeLessThan(5000);
		expect(result.reads).toBe(0);
		expect(result.lockReleased).toBe(true);
		expect(result.healthy).toBe(true);
	});
});
