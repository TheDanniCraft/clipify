import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let state: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the MCP database request is {string} with independently borrowed database connections", async ({}, value: string) => {
	state = value;
});
When("the client aborts that database request", async () => {
	result = runMcpProbe("database-abort-probe", [state]);
});
Then("that request terminates promptly without a later commit and unrelated database work remains healthy", async () => {
	expect(result.reached).toBe(true);
	expect(result.status).toBe(400);
	expect(result.body).toEqual({ error: "invalid_request" });
	expect(result.elapsedAfterAbort).toBeLessThan(1000);
	expect(result.workReleased).toBe(true);
	expect(result.committed).toBe(0);
	expect(result.unrelatedHealthy).toBe(true);
	expect(result.healthy).toBe(true);
});
