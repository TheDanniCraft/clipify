/** @jest-environment node */
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-006 owner Pro allocation source", () => {
	test.each(["allocation-revoke", "allocation-remove", "allocation-expire"])("%s waits for current allocation-authorized mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
	test("chat allocation revoke waits for allocation-authorized command", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-chat-policy-allocation-revoke"]);
		expect(r.volumeRows.every((row: any) => row.configuration_revision === 2)).toBe(true);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
