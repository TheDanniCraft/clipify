import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof flowProbe>;
Given("an approved quota transaction will fail during {string}", async ({}, value: string) => {
	mode = value;
});
Given("an approved quota transaction will exercise {string}", async ({}, value: string) => {
	mode = value;
});
When("the agent exercises that quota transaction through authenticated public interfaces", async () => {
	result = flowProbe(`catalogue:quota-invariants:${mode}`);
});
Then("the failed insert leaves no resource retry or successful audit and its retry succeeds", async () => {
	expect(result.first).toEqual({ status: 200, success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.rolledBack).toEqual({ resources: 0, retries: 0, successful_audits: 0 });
	expect(result.retry).toEqual({ status: 200, success: true, code: null });
	expect(result.final).toEqual({ resources: 1, retries: 1, successful_audits: 1 });
});
Then("the original overlay is deleted and concurrent creation cannot exceed the allowance", async () => {
	expect(result.deleted).toBe(true);
	expect(result.originalPresent).toBe(false);
	expect(result.created.status).toBe(200);
	expect(result.created.code).toBe(result.created.success ? null : "PLAN_LIMIT_REACHED");
	expect(result.final.resources).toBe(result.created.success ? 1 : 0);
});
Then("the unrelated creator completes while the first creator remains blocked", async () => {
	expect(result).toEqual({ reached: true, blockedStillPending: true, independentCreated: true, releasedCreated: true, firstCreatorCount: 1, independentCount: 1 });
});
