import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a browser playlist deletion has {word} context", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("its verified session adapter deletes the playlist", async ({ mcpWorld }) => {
	mcpWorld.result = runMcpProbe("browser-playlist-delete-probe", [String(mcpWorld.input?.mode)]);
});
Then("browser deletion is {word} with atomic reference state", async ({ mcpWorld }, outcome: string) => {
	const result = mcpWorld.result as any;
	expect(result.available).toBe(true);
	expect(result.deleted).toBe(outcome === "deleted");
	expect(result.state.playlists).toBe(outcome === "deleted" ? 0 : 1);
	expect(result.state.items).toBe(outcome === "deleted" ? 0 : 1);
	expect(result.state.overlay.configuration_revision).toBe(outcome === "deleted" ? 2 : 1);
	expect(result.state.overlay.playlist_id).toBe(outcome === "deleted" ? null : "a1dca8b8-089a-47ce-b649-1c32bb3842c1");
	expect(result.state.gallery.published).toBe(outcome !== "deleted");
});
