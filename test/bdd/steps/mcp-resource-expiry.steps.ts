import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let resource: string;
let authority: string;
let result: ReturnType<typeof runMcpProbe>;
Given("an AI {string} edit waits for a resource lock with {string} authority", async ({}, kind: string, expiry: string) => {
	resource = kind;
	authority = expiry;
});
When("the resource lock is released after that authority boundary", async () => {
	result = runMcpProbe("resource-expiry-probe", [resource, authority]);
});
Then("expired authority leaves configuration revision and audit unchanged while active authority commits", async () => {
	expect(result.waited).toBe(true);
	expect(result.success).toBe(authority === "active");
	expect(result.error).toBe(authority === "active" ? null : "AUTHENTICATION_REQUIRED");
	expect(result.current).toEqual({ name: authority === "active" ? "After" : "Before", configuration_revision: authority === "active" ? 2 : 1 });
	expect(result.audits).toBe(authority === "active" ? 1 : 0);
});
