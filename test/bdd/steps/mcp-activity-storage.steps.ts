import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("required MCP audit storage fails for {string}", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("the authenticated request reaches the actual MCP route", async ({ mcpWorld }) => {
	mcpWorld.result = flowProbe(`${mcpWorld.input?.mode}:audit-storage-failure`);
});
Then("it reports a safe service error without data or an unrecorded successful operation", async ({ mcpWorld }) => {
	const result = mcpWorld.result as any;
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.activityRecords).toEqual([]);
	expect(result.resourceResult.items).toBeUndefined();
	expect(result.resourceResult.overlay).toBeUndefined();
	expect(result.resourceResult.playlist).toBeUndefined();
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|private-clip-token|private-input-value|controlled private audit|Bearer/);
});
