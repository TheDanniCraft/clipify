/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-002 membership policy", () => {
	test.each(["membership-remove", "membership-role"])("%s waits for current authorized mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
