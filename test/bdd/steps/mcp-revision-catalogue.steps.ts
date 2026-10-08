import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let catalogue: any;
let row: any;
When("resource {string} is edited first by {word} and then by {word}", async ({}, resource: string, first: string, second: string) => {
	catalogue ??= flowProbe("catalogue:revisions");
	row = catalogue.transitions.find((value: any) => value.resource === resource && value.first === first && value.second === second);
	expect(row).toBeDefined();
});
Then("the stale second writer preserves the first committed configuration", async () => {
	expect(row.committed.success).toBe(true);
	expect(row.rejected.success).toBe(false);
	expect(row.rejected.error).toBe(row.second === "MCP" ? "CONFLICT" : "BROWSER_REJECTED");
	expect(row.afterStale).toEqual(row.beforeStale);
	expect(row.afterStale[row.resource === "overlay" ? "overlay" : "playlist"].configuration_revision).toBe(2);
});
Then("the rejected writer can read the latest revision and commit its new edit", async () => {
	expect(row.rejected.success).toBe(false);
	expect(row.afterStale).toEqual(row.beforeStale);
	expect(row.fresh.success).toBe(true);
	expect(row.afterFresh[row.resource === "overlay" ? "overlay" : "playlist"].configuration_revision).toBe(3);
	if (row.resource === "playlist items") expect(row.afterFresh.items.map((item: any) => item.clip_id)).toEqual(["ClipA", "ClipB"]);
	else expect(row.afterFresh[row.resource].name).toBe("Second");
});
