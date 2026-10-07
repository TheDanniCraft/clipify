import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
let mode: string;
When("a verified browser reward edit has {word} metadata behavior", async ({}, behavior: string) => {
	mode = behavior;
	result = runMcpProbe("overlay-reward-ownership-probe", [behavior], 30000);
});
Then("the owned reward, audit and subscription intent commit together", async () => {
	expect(result).toMatchObject({ saved: true, rewardId: "RewardOne", revision: 2, jobs: 1, audits: 1, calls: 1, requestValid: true, lockFree: true });
});
Then("the reward edit leaves no configuration change, audit or subscription intent", async () => {
	expect(result).toMatchObject({ saved: false, rewardId: null, revision: mode === "revision-change" ? 2 : 1, jobs: 0, audits: 0, calls: 1, requestValid: true, lockFree: true });
});
Then("stalled reward validation returns without committing within five seconds", async () => {
	expect(result).toMatchObject({ saved: false, rewardId: null, revision: 1, jobs: 0, audits: 0 });
	expect(result.elapsedMs).toBeGreaterThanOrEqual(4500);
	expect(result.elapsedMs).toBeLessThan(7500);
	if (mode !== "credentials") expect(result).toMatchObject({ calls: 1, requestValid: true, lockFree: true });
});
