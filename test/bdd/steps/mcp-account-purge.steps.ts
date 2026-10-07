import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let lifecycle: string;
let result: ReturnType<typeof runMcpProbe>;
Given("a creator's MCP data has an {string} account lifecycle change", async ({}, value: string) => {
	lifecycle = value;
});
When("the bounded MCP privacy cleanup runs after that change", async () => {
	result = runMcpProbe("account-purge-probe", [lifecycle]);
});
Then("deleted account MCP records are cleaned while foreign history billing audits and suspended recovery data are preserved", async () => {
	expect(result.deleted).toBe(lifecycle === "suspended" ? 0 : 1);
	expect(result.remaining).toEqual(lifecycle === "suspended" ? ["billing", "foreign", "own"] : ["billing", "foreign"]);
	expect(result.counts).toEqual(lifecycle === "actor" ? { grants: 0, approvals: 0, retries: 0, access: 0, refresh: 0, consents: 0 } : lifecycle === "creator" ? { grants: 1, approvals: 0, retries: 0, access: 1, refresh: 1, consents: 1 } : { grants: 1, approvals: 1, retries: 1, access: 1, refresh: 1, consents: 1 });
});
