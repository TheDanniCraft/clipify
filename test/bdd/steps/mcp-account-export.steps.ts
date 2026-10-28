import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let state: string;
let result: ReturnType<typeof runMcpProbe>;
Given("an account has an AI app approval that is {string}", async ({}, value: string) => {
	state = value;
});
When("the account's comprehensive private export is collected", async () => {
	result = runMcpProbe("account-export-probe", [state]);
});
Then("it includes that app's approved scopes and creators without another user's approval or app credentials", async () => {
	expect(result.mcp.connections).toEqual([expect.objectContaining({ id: result.ownId, clientName: "Custom AI", scopes: ["creator:read", "overlay:read"], active: state === "active", creators: [{ creatorId: "creator", agencyOrganizationId: null }] })]);
	expect(result.mcp.grants).toEqual([expect.objectContaining({ id: result.ownId, authUserId: "owner", generation: 1, scopes: ["creator:read", "overlay:read"], active: state === "active" })]);
	expect(result.mcp.creatorApprovals).toEqual([expect.objectContaining({ grantId: result.ownId, creatorId: "creator", agencyOrganizationId: null })]);
	expect(result.leaksPrivateClientData).toBe(false);
	expect(result.leaksForeignGrant).toBe(false);
});
