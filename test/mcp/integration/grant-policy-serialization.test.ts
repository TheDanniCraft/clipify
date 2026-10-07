/** @jest-environment node */
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-005 owner Pro grant source", () => {
	test.each(["grant-revoke", "grant-remove", "grant-expire", "global-grant-revoke", "global-grant-remove", "global-grant-expire"])("%s waits for current grant-authorized mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
	test.each(["grant-revoke", "global-grant-revoke"])("chat %s waits for grant-authorized command", (change) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-chat-policy-" + change]);
		expect(r.volumeRows.every((row: any) => row.configuration_revision === 2)).toBe(true);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
