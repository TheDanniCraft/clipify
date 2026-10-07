/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-PRIVACY-006 cleanup independent of public MCP flag", () => {
	test.each(["ready", "legacy"])("%s schema preserves privacy and rollout boundaries with MCP off", (mode) => {
		const result = runMcpProbe("cleanup-disabled-probe", [mode]);
		expect(result.remaining).toEqual(mode === "ready" ? ["disabled-2", "disabled-3"] : ["disabled-1", "disabled-2", "disabled-3"]);
		expect(result.serviceStatus).toBe(503);
		expect(result.finished).toBe(true);
		expect(result.healthy).toBe(true);
		if (mode === "ready") expect(result.started).toBe(true);
	});
});
