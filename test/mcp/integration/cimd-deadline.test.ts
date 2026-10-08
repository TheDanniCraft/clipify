/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-CIMD-DEADLINE-001 actual metadata DNS dependency boundary", () => {
	test.each(["stalled", "private"])("%s DNS fails safely without an unbounded authorization wait", (mode) => {
		const result = runMcpProbe("cimd-deadline-probe", [mode], 25000);
		expect(result.elapsed).toBeLessThan(11000);
		expect(result.error).toBe("invalid_client");
		expect(result.lookups).toBe(1);
		expect(result.clients).toBe(0);
		expect(result.transportAborted).toBe(true);
		if (mode === "private") expect(result.transportCalls).toBe(0);
	});
});
