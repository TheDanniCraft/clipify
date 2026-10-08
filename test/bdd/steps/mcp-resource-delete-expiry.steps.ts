import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let resource: string;
let authority: string;
let result: ReturnType<typeof runMcpProbe>;
Given("an AI {string} deletion waits for a resource lock with {string} authority", async ({}, kind: string, expiry: string) => {
	resource = kind;
	authority = expiry;
});
When("the deletion resource lock is released after that authority boundary", async () => {
	result = runMcpProbe("resource-expiry-probe", [resource, authority, "delete"]);
});
Then("expired authority preserves the resource and audit while active explicit delete authority commits", async () => {
	expect(result.waited).toBe(true);
	expect(result.success).toBe(authority === "active");
	expect(result.error).toBe(authority === "active" ? null : "AUTHENTICATION_REQUIRED");
	expect(result.current).toEqual(authority === "active" ? null : { name: "Before", configuration_revision: 1 });
	expect(result.audits).toBe(authority === "active" ? 1 : 0);
});
