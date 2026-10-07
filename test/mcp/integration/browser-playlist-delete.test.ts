/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
describe("TDD-BROWSER-DELETE-002 real verified-session shared deletion", () => {
	test("deletes items and detaches references with overlay revision advance", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["normal"]);
		expect(result.available).toBe(true);
		expect(result.deleted).toBe(true);
		expect(result.state).toEqual({ playlists: 0, items: 0, overlay: { playlist_id: null, configuration_revision: 2 }, gallery: { playlist_id: null, published: false } });
	});
	test.each(["stale", "missing", "missing-revision", "foreign", "removed", "suspended", "expired-session"])("%s request preserves all data", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [mode]);
		expect(result.available).toBe(true);
		expect(result.deleted).toBe(false);
		expect(result.state).toEqual({ playlists: 1, items: 1, overlay: { playlist_id: playlistId, configuration_revision: 1 }, gallery: { playlist_id: playlistId, published: true } });
	});
});
