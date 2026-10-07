/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-OVERLAY-SAVE-001 verified configuration adapter", () => {
	test.each(["basic", "pro"])("%s saves one exact revision with session attribution", (mode) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-save" + (mode === "pro" ? "-pro" : "")]);
		expect(r.deleted).toMatchObject({ configurationRevision: 2 });
		expect(r.storedOverlay).toMatchObject({ configuration_revision: 2, ...(mode === "pro" ? { player_volume: 73 } : { name: "Browser renamed overlay" }) });
		expect(r.activity).toHaveLength(1);
		expect(r.activity[0]).toMatchObject({ action: "overlay.update", actor_user_id: "owner", actor_session_id: r.sessionId });
		expect(r.activity[0].metadata.grantId).toBeUndefined();
	});
	test.each(["stale", "missing", "removed", "suspended", "free-advanced", "invalid"])("%s fails without changing stored configuration", (mode) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-" + mode]);
		expect(r.deleted).toBeNull();
		expect(r.storedOverlay).toMatchObject({ name: "Linked", configuration_revision: 1 });
		expect(r.activity).toEqual([]);
	});
});
