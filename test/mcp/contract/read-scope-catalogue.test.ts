/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-READ-SCOPES-001 read tools require their own OAuth permission", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:read-scopes");
	});
	test.each([
		["list_creators", "creator:read"],
		["get_capabilities", "creator:read"],
		["list_overlays", "overlay:read"],
		["get_overlay", "overlay:read"],
		["list_playlists", "playlist:read"],
		["get_playlist", "playlist:read"],
	])("%s denies missing %s before exposing data", (name, permission) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toEqual({ name, permission, status: 403, insufficientScope: true, counts: { overlays: 1, playlists: 1, retries: 0, effects: 0 }, leakedData: false });
	});
});
