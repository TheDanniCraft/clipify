import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("an MCP client sends an incomplete body that is {word}", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("the public MCP route finishes reading the body", async ({ mcpWorld }) => {
	mcpWorld.result = runMcpProbe("request-boundary-probe", [String(mcpWorld.input?.mode)]);
});
Then("the request returns {int} and releases the body reader", async ({ mcpWorld }, status: number) => {
	expect(mcpWorld.result?.status).toBe(status);
	expect((mcpWorld.result as any)?.cancelled).toBe(true);
});
