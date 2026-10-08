/** @jest-environment node */
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
describe("TDD-POLICY-WRITER-001 current owner policy serialization", () => {
	test.each(["plan", "disabled"])("MCP %s writer waits for current mutation", (change) => {
		const r = flowProbe("resources:overlay-update:policy-" + change);
		expect(r.resourceResult.overlay.configurationRevision).toBe(2);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
	test.each(["plan", "disabled"])("trusted chat %s writer waits for current mutation", (change) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-chat-policy-" + change]);
		expect(r.volumeRows.every((row: any) => row.configuration_revision === 2)).toBe(true);
		expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	});
});
