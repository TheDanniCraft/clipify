/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-004 agency creator link", () => {
	test.each(["agency-ceiling", "agency-revoke", "agency-delete"])("%s waits for current authorized agency mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
