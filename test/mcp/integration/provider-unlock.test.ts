/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-004 provider lock cleanup recovery", () => {
	test.each(["failure", "healthy"])("%s release leaves subsequent independent credentials usable", (mode) => {
		const result = runMcpProbe("provider-unlock-probe", [mode]);
		expect(result.completed).toBe(true);
		expect(result.injected).toBe(mode === "failure");
		expect(result.lockReleased).toBe(true);
		expect(result.healthy).toBe(true);
	});
});
