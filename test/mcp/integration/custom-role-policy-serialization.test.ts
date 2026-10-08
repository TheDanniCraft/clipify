/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-003 custom role definition", () => {
	test.each(["custom-role", "custom-role-remove"])("%s waits for current authorized mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
