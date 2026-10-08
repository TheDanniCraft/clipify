import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
When("a verified Pro owner saves a reward through the shared overlay backend", async () => {
	result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox"]);
});
Then("its committed revision has a durable pending subscription job", async () => {
	expect(result.deleted).toMatchObject({ rewardId: "RewardOne", configurationRevision: 2 });
	expect(result.effectJobs).toEqual([expect.objectContaining({ overlay_id: result.deleted.id, creator_id: "creator", reward_id: "RewardOne", configuration_revision: 2, status: "pending", attempts: 0 })]);
});
When("a verified Pro owner saves a reward using a stale overlay revision", async () => {
	result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox-stale"]);
});
Then("neither reward configuration nor a subscription job is committed", async () => {
	expect(result.deleted).toBeNull();
	expect(result.storedOverlay).toMatchObject({ configuration_revision: 1, reward_id: null });
	expect(result.effectJobs).toEqual([]);
	expect(result.activity).toEqual([]);
});

When("the public save action commits a verified Pro reward selection", async () => {
	result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox-public"], 45000);
});
Then("exactly one durable reward job exists without an immediate provider call", async () => {
	expect(result.deleted).toMatchObject({ rewardId: "RewardOne", configurationRevision: 2 });
	expect(result.effectJobs).toHaveLength(1);
	expect(result.providerRequests).toEqual([]);
});
