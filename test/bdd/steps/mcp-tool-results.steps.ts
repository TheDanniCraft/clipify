import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
import { PUBLIC_TOOL_NAMES } from "../../support/mcp/public-tool-expectations";
const { Given, When, Then } = createBdd();
let result: any;
Given("a creator has overlays, OAuth connections, and runner credentials", async () => {
	result = undefined;
});
When("the client reads every supported tool result", async () => {
	result = flowProbe("catalogue:tool-results");
});
Then("no secret or credential appears and excluded operations are unavailable", async () => {
	expect(result.discovery.status).toBe(200);
	expect(result.discovery.secretFree).toBe(true);
	expect([...result.discovery.names].sort()).toEqual([...PUBLIC_TOOL_NAMES].sort());
	expect(result.outcomes).toHaveLength(15);
	for (const row of result.outcomes) expect(row).toEqual({ name: row.name, status: 200, success: true, secretFree: true });
	expect(result.excluded).toHaveLength(4);
	for (const row of result.excluded) expect(row).toEqual({ name: row.name, denied: true, secretFree: true });
	expect(result.providerCalls).toBe(1);
});
