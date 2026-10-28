import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US3-042 provider timeout cannot produce mutation success or partial writes", () => {
	test.each(["headers", "body"])("stalled provider %s preserves saved items and audit", (phase) => {
		const result = flowProbe(`resources:playlist-add:provider-timeout-${phase}`);
		expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
		expect(result.resourceResult.playlist).toBeUndefined();
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
		]);
		expect(result.externalClipRequests).toBe(1);
		expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/controlled provider deadline|private-|ownerId|secret/);
	});
});
