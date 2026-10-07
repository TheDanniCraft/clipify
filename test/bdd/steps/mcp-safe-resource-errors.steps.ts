import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let operation: string;
let result: ReturnType<typeof flowProbe>;
Given("the approved MCP request targets unavailable resource operation {string}", async ({}, value: string) => {
	operation = value;
});
When("the agent requests that unavailable resource", async () => {
	result = flowProbe(`resources:${operation}`);
});
Then("Clipify returns only the safe unavailable resource error", async () => {
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.error).toMatchObject({ code: "RESOURCE_UNAVAILABLE", correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
	expect(Object.keys(result.resourceResult.error).sort()).toEqual(["code", "correlationId", "message"]);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/Private overlay|foreign-owner|private-foreign|Existing playlist|First clip|private-overlay-secret|ownerId|rewardId/);
});
Given("a playlist deletion audit cannot persist", async () => {
	operation = "playlist-delete:audit-failure";
});
When("the agent deletes the playlist with approved authority", async () => {
	result = flowProbe(`resources:${operation}`);
});
Then("Clipify reports a safe service failure and preserves the playlist and its references", async () => {
	expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.resourceResult.deletedId).toBeUndefined();
	expect(result.deletionState).toEqual({ playlists: 1, items: 2, overlay: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", configuration_revision: 1 }, gallery: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", published: true } });
	expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/controlled delete audit failure|audit_events|reject_playlist_delete|password|secret/);
});
Given("the clip provider stalls during {string} for an approved append", async ({}, phase: string) => {
	operation = `playlist-add:provider-timeout-${phase}`;
});
When("the agent adds validated provider clips to the playlist", async () => {
	result = flowProbe(`resources:${operation}`);
});
Then("Clipify reports a safe timeout failure with unchanged playlist items and audit", async () => {
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
