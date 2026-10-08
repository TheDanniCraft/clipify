/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-012 delete_playlist through authenticated MCP", () => {
	const playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	test("deletes playlist/items and detaches overlay/gallery references atomically", () => {
		const result = flowProbe("resources:playlist-delete");
		expect(result.resourceResult).toEqual({ deletedId: playlistId });
		expect(result.deletionState).toEqual({ playlists: 0, items: 0, overlay: { playlist_id: null, configuration_revision: 2 }, gallery: { playlist_id: null, published: false } });
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
	])("%s deletion preserves resources and references", (mode, code) => {
		const result = flowProbe(`resources:playlist-delete:${mode}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.deletionState).toEqual({ playlists: 1, items: 2, overlay: { playlist_id: playlistId, configuration_revision: 1 }, gallery: { playlist_id: playlistId, published: true } });
	});
	test("requires separately approved playlist deletion scope", () => {
		const result = flowProbe("resources:playlist-delete:no-scope");
		expect(result.protocolStatus).toBe(403);
		expect(result.challenge).toContain("insufficient_scope");
		expect(result.deletionState.playlists).toBe(1);
		expect(result.deletionState.overlay.configuration_revision).toBe(1);
	});
});

test("playlist deletion audit failure restores items, overlay revision and published gallery references", () => {
	const result = flowProbe("resources:playlist-delete:audit-failure");
	expect(result.resourceResult?.error?.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.deletionState).toEqual({ playlists: 1, items: 2, overlay: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", configuration_revision: 1 }, gallery: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", published: true } });
});
