/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
export const modes = ["resources:creators", "resources:capabilities", "resources:overlays", "resources:overlay-get", "resources:playlists", "resources:playlist-get", "resources:overlay-get:denied", "resources:overlays:unknown"];
describe("TDD-ACTIVITY-STORAGE-001 required audit writes fail closed", () => {
	test.each(modes)("%s cannot return successful data or hide missing audit persistence", (mode) => {
		const result = flowProbe(`${mode}:audit-storage-failure`);
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
		expect(result.resourceResult.items).toBeUndefined();
		expect(result.resourceResult.overlay).toBeUndefined();
		expect(result.resourceResult.playlist).toBeUndefined();
		expect(result.activityRecords).toEqual([]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|private-clip-token|private-input-value|controlled private audit|Bearer/);
	});
});
