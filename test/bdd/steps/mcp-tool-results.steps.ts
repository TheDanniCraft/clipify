import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: any;
Given("a creator has overlays, OAuth connections, and runner credentials", async () => {
	result = undefined;
});
When("the client reads every supported tool result", async () => {
	result = flowProbe("catalogue:tool-results");
});
Then("no secret or credential appears and excluded operations are unavailable", async () => {
	const names = ["list_creators", "get_capabilities", "list_overlays", "get_overlay", "create_overlay", "update_overlay", "delete_overlay", "list_playlists", "get_playlist", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"];
	expect(result.discovery.status).toBe(200);
	expect(result.discovery.secretFree).toBe(true);
	expect([...result.discovery.names].sort()).toEqual([...names].sort());
	expect(result.outcomes).toHaveLength(15);
	for (const row of result.outcomes) expect(row).toEqual({ name: row.name, status: 200, success: true, secretFree: true });
	expect(result.excluded).toHaveLength(4);
	for (const row of result.excluded) expect(row).toEqual({ name: row.name, denied: true, secretFree: true });
	expect(result.providerCalls).toBe(1);
});
