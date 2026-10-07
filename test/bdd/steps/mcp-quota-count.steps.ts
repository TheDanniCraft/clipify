import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let kind: string;
let boundary: string;
let result: ReturnType<typeof flowProbe>;
Given("an approved Free creator has {string} usage at the {string} boundary", async ({}, resource: string, phase: string) => {
	kind = resource;
	boundary = phase;
});
When("the agent creates that resource and repeats its original retry key", async () => {
	result = flowProbe(`resources:${kind}-create:boundary-${boundary}`);
});
Then("the current Free quota permits only available capacity and preserves count", async () => {
	const usage = boundary === "above" ? 2 : boundary === "exact" ? 1 : 0;
	expect(result.protocolStatus).toBe(200);
	if (usage >= 1) {
		expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage, limit: 1 });
		expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage, limit: 1 });
		expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	} else {
		expect(result.resourceResult.created).toMatchObject({ creatorId: "fixture-creator", configurationRevision: 1 });
		expect(result.resourceResult.replayed).toEqual(result.resourceResult.created);
	}
	expect(kind === "overlay" ? result.resourceCount : result.playlistCount).toBe(Math.max(1, usage));
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|ownerId|secret|token/);
});
