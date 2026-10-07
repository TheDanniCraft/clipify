/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-PRIVACY-005 deleted account MCP data lifecycle", () => {
	test.each(["actor", "creator", "suspended"])("%s lifecycle clears only orphan MCP data", (mode) => {
		const result = runMcpProbe("account-purge-probe", [mode]);
		expect(result.deleted).toBe(mode === "suspended" ? 0 : 1);
		expect(result.remaining).toEqual(mode === "suspended" ? ["billing", "foreign", "own"] : ["billing", "foreign"]);
		expect(result.counts).toEqual(mode === "actor" ? { grants: 0, approvals: 0, retries: 0, access: 0, refresh: 0, consents: 0 } : mode === "creator" ? { grants: 1, approvals: 0, retries: 0, access: 1, refresh: 1, consents: 1 } : { grants: 1, approvals: 1, retries: 1, access: 1, refresh: 1, consents: 1 });
	});
});
