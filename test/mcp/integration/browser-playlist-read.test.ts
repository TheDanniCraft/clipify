/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

describe("browser playlist read preservation before shared service extraction", () => {
	test("owner list retains names and saved clip counts", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["playlist-list-owner"]);
		expect(result.playlistReadObservation).toEqual({ available: true, names: ["Browser playlist"], clipCounts: [1] });
	});
	test("owner clip lookup retains ordered saved metadata", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["playlist-get-owner"]);
		expect(result.playlistReadObservation).toEqual({ available: true, clipIds: ["ClipFirst"], titles: ["First"] });
	});
	test.each(["removed", "read-denied"])("%s listing returns no saved creator playlists", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`playlist-list-${mode}`]);
		expect(result.playlistReadObservation).toEqual({ available: true, names: [], clipCounts: [] });
	});
	test.each(["removed", "read-denied"])("%s clip lookup returns no saved contents", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`playlist-get-${mode}`]);
		expect(result.playlistReadObservation).toEqual({ available: true, clipIds: [], titles: [] });
	});
});
