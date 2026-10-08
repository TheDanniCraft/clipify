/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-OVERLAY-DELETE-001 verified overlay deletion", () => {
	test("current browser revision deletes with verified session audit", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-delete"]);
		expect(r.deleted).toBe(true);
		expect(r.overlayCount).toBe(0);
		expect(r.state.playlists).toBe(1);
		expect(r.state.items).toBe(1);
		expect(r.activity).toHaveLength(1);
		expect(r.activity[0]).toMatchObject({ action: "overlay.delete", actor_user_id: "owner", actor_session_id: r.sessionId });
		expect(r.activity[0].metadata.clientId).toBeUndefined();
	});
	test.each(["stale", "missing", "missing-revision", "foreign", "removed", "suspended", "expired"])("%s cannot delete or audit success", (mode) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-" + mode]);
		expect(r.deleted).toBe(false);
		expect(r.overlayCount).toBe(1);
		expect(r.state.overlay.configuration_revision).toBe(1);
		expect(r.activity).toEqual([]);
	});
});
