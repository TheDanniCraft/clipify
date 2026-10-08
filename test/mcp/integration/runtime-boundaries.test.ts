/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-001 real MCP database deadline", () => {
	test.each(["statement", "connection"])("%s stalls terminate within the ten-second budget", (mode) => {
		const r = runMcpProbe("database-deadline-probe", [mode], 30000);
		expect(r.status).toBe(503);
		expect(r.body).toEqual({ error: "service_unavailable" });
		expect(r.elapsed).toBeLessThan(11000);
		expect(r.workReleased).toBe(true);
		if (mode === "statement") {
			expect(r.codes).toEqual(["57014"]);
			expect(r.healthy).toBe(true);
		}
	});
});

test("TDD-LOAD-001 warmed twenty independent creators meet read and mutation budgets", () => {
	const result = runMcpProbe("flow-probe", ["benchmark:20"], 90000);
	console.info("Isolated MCP benchmark", JSON.stringify(result));
	expect(result.settings).toMatchObject({ concurrency: 20, independentCreators: 20, warmupCalls: 40, measuredCalls: 40, samplesPerOperation: 20 });
	expect(result.readsMs).toHaveLength(20);
	expect(result.mutationsMs).toHaveLength(20);
	expect(result.rows).toEqual([{ configuration_revision: 3, count: 20 }]);
	expect(result.budget).toEqual([80]);
	expect(result.unexpectedNetworkCalls).toBe(0);
	expect(result.p95ReadMs).toBeLessThanOrEqual(1000);
	expect(result.p95MutationMs).toBeLessThanOrEqual(2000);
}, 120000);
