import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let resource: string;
let authority: string;
let result: ReturnType<typeof runMcpProbe>;
Given("AI {string} creation waits for audit persistence with {string} authority", async ({}, kind: string, expiry: string) => {
	resource = kind;
	authority = expiry;
});
When("the audit persistence lock is released after the authority boundary", async () => {
	result = runMcpProbe("create-expiry-probe", [resource, authority]);
});
Then("expired authority rolls back the resource retry record and audit while active authority commits them together", async () => {
	expect(result.waited).toBe(true);
	expect(result.success).toBe(authority === "active");
	expect(result.error).toBe(authority === "active" ? null : "AUTHENTICATION_REQUIRED");
	expect(result.resources).toBe(authority === "active" ? 1 : 0);
	expect(result.retries).toBe(authority === "active" ? 1 : 0);
	expect(result.audits).toBe(authority === "active" ? 1 : 0);
});
