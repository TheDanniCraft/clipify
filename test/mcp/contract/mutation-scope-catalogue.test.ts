/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("each mutation requires its independently approved OAuth scope", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:mutation-scopes");
	});
	test.each([
		["create_overlay", "overlay:create"],
		["update_overlay_settings", "overlay:update"],
		["delete_overlay", "overlay:delete"],
		["create_playlist", "playlist:create"],
		["update_playlist", "playlist:update"],
		["delete_playlist", "playlist:delete"],
		["add_playlist_items", "playlist-items:manage"],
		["remove_playlist_items", "playlist-items:manage"],
		["reorder_playlist_items", "playlist-items:manage"],
	])("%s rejects missing %s before validation or persistence", (name, permission) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toEqual({ name, permission, status: 403, insufficientScope: true, counts: { overlays: 0, playlists: 0, retries: 0, effects: 0 } });
	});
});
