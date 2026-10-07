/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("shared resource services reject malformed input before authority or resource access", () => {
	const result = runMcpProbe("resource-input-probe", []);
	const operations = ["listOverlays", "getOverlay", "createOverlay", "updateOverlay", "deleteOverlay", "listPlaylists", "getPlaylist", "createPlaylist", "updatePlaylist", "deletePlaylist", "addItems", "removeItems", "reorderItems", "saveItems", "ownerVolumeWithOAuth", "invalidChatActor"];
	const expected = Object.fromEntries(operations.map((operation) => [operation, "INVALID_INPUT"]));
	// An unseeded actor would produce ACCESS_DENIED if validation reached authority.
	// OAuth must also never use the session-only volume writer.
	expect(result.results).toEqual(expected);
	expect(result.writes).toBe(0);
});
