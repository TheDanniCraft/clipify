import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a playlist append has saved metadata outside the safe output contract", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:playlist-add:invalid-result" };
});
When("the MCP client appends validated clips to that playlist", async ({ mcpWorld }) => {
	const result = flowProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the result failure rolls back clips revision and successful audit", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.persistedPlaylist.configuration_revision).toBe(1);
	expect(result.persistedItems).toEqual([
		{ clip_id: "ClipFirst", position: 0 },
		{ clip_id: "ClipSecond", position: 1 },
	]);
	expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	expect(result.externalClipRequests).toBe(1);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-result|secret|token/);
});
