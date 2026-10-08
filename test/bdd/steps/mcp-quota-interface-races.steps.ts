import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof flowProbe>;
Given("twenty independent {string} requests target an empty Free creator", async ({}, value: string) => {
	mode = value;
});
When("all creation requests run concurrently through their public interfaces", async () => {
	result = flowProbe(`catalogue:quota-races:${mode}`);
});
Then("exactly one overlay exists and nineteen requests receive plan limit errors with {int} browser and {int} MCP requests", async ({}, browserRequests: number, mcpRequests: number) => {
	expect(result).toMatchObject({ resources: 1, successes: 1, browserRequests, mcpRequests });
	expect(result.outcomes).toHaveLength(20);
	expect(result.outcomes.every((row: { status: number }) => row.status === 200)).toBe(true);
	expect(result.denials).toHaveLength(19);
	expect(new Set(result.denials)).toEqual(new Set(["PLAN_LIMIT_REACHED"]));
});
