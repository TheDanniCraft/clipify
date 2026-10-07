import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { consentTargetProbe } from "../../support/mcp/consent-target-client";
const { Given, When, Then } = createBdd(test);
Given("offline-only consent selects an {string} creator", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("the signed-in actor approves that offline connection", async ({ mcpWorld }) => {
	const result = consentTargetProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.status, body: result };
});
Then("consent returns status {int} with {int} active grants", async ({ mcpWorld }, status: number, count: number) => {
	expect(mcpWorld.result?.status).toBe(status);
	expect(mcpWorld.result?.body.grants).toHaveLength(count);
	expect(mcpWorld.result?.body.issuedCode).toBe(count > 0);
	if (count) expect(mcpWorld.result?.body.grants[0]).toEqual({ active: true, scopes: ["offline_access"] });
});
