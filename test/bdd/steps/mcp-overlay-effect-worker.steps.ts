import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
When("a pending reward job encounters a provider failure and the next due worker succeeds", async () => {
	result = runMcpProbe("overlay-effect-worker-probe", [], 45000);
});
Then("provider calls run outside resource locks and durable retry completes the existing job", async () => {
	expect(result.available).toBe(true);
	expect(result.outsideResourceLock).toBe(true);
	expect(result.calls).toBe(2);
	expect(result.earlyCalls).toBe(1);
	expect(result.afterFailure.jobs).toEqual([expect.objectContaining({ status: "retry", attempts: 1, last_error: "provider_unavailable", claimed_by: null, claim_expires_at: null })]);
	expect(result.afterRetry.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 2, last_error: null, claimed_by: null, claim_expires_at: null })]);
	expect(result.afterFailure.resources).toEqual([{ configuration_revision: 1, reward_id: "RewardOne" }]);
	expect(result.afterRetry.resources).toEqual(result.afterFailure.resources);
});

When("pending reward work encounters {word} configuration", async ({}, change: string) => {
	result = runMcpProbe("overlay-effect-worker-probe", [change], 45000);
});
Then("provider work has {int} calls and {word} status", async ({}, calls: number, status: string) => {
	expect(result.calls).toBe(calls);
	if (status === "absent") expect(result.state).toEqual({ jobs: [], resources: [] });
	else expect(result.state.jobs).toEqual([expect.objectContaining({ status, attempts: 1, claimed_by: null, claim_expires_at: null })]);
	if (result.mode === "name-only") expect(result.state.resources).toEqual([{ configuration_revision: 2, reward_id: "RewardOne" }]);
});

When("reward workers encounter {word} job leases", async ({}, condition: string) => {
	result = runMcpProbe("overlay-effect-worker-probe", [condition], 45000);
});
Then("their exact provider rewards are {word}", async ({}, rewards: string) => {
	expect(result.calls).toEqual(rewards === "none" ? [] : rewards.split(","));
	if (result.mode === "not-due") expect(result.jobs).toEqual([expect.objectContaining({ status: "pending", attempts: 0 })]);
	else if (result.mode === "lease-replaced") expect(result.jobs).toEqual([expect.objectContaining({ reward_id: "RewardOne", status: "done", attempts: 1 }), expect.objectContaining({ reward_id: "RewardTwo", status: "done", attempts: 2 })]);
	else expect(result.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 1 })]);
});
