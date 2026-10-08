/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-PRIVACY-002 bounded MCP activity retention", () => {
	test.each(["normal", "bounded", "concurrent"])("%s cleanup preserves current activity and unrelated audits", (mode) => {
		const result = runMcpProbe("activity-retention-probe", [mode]);
		expect(result.available).toBe(true);
		expect(result.error).toBeNull();
		expect(result.remaining).toEqual(mode === "bounded" ? ["retention-2", "retention-3", "retention-4", "retention-5", "retention-6"] : ["retention-3", "retention-4", "retention-5", "retention-6"]);
		expect(result.result).toEqual(mode === "concurrent" ? [1, 1] : mode === "bounded" ? 1 : 2);
	});
	test("invalid timestamp deletes nothing", () => {
		const result = runMcpProbe("activity-retention-probe", ["invalid-time"]);
		expect(result.available).toBe(true);
		expect(result.error).toBe("INVALID_INPUT");
		expect(result.remaining).toHaveLength(6);
	});
});
