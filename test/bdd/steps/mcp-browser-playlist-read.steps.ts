import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a browser playlist {string} request has {string} authority", async ({ mcpWorld }, operation: string, mode: string) => {
	expect(["list", "get"]).toContain(operation);
	expect(["owner", "removed", "read-denied"]).toContain(mode);
	mcpWorld.input = { mode: `playlist-${operation}-${mode}` };
});
When("the verified browser requests playlist records", async ({ mcpWorld }) => {
	const result = runMcpProbe("browser-playlist-delete-probe", [String(mcpWorld.input?.mode)]);
	mcpWorld.result = { status: 200, body: result };
});
Then("playlist saved contents follow the current {string} permission", async ({ mcpWorld }, mode: string) => {
	const owner = mode === "owner";
	expect(mcpWorld.result?.body.playlistReadObservation).toEqual(String(mcpWorld.input?.mode).startsWith("playlist-list-") ? { available: true, names: owner ? ["Browser playlist"] : [], clipCounts: owner ? [1] : [] } : { available: true, clipIds: owner ? ["ClipFirst"] : [], titles: owner ? ["First"] : [] });
});
