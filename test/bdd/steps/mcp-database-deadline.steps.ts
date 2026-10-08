import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let kind: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the MCP database dependency stalls during {string}", async ({}, value: string) => {
	kind = value;
});
When("the client requests MCP tools from that unavailable dependency", async () => {
	result = runMcpProbe("database-deadline-probe", [kind], 30000);
});
Then("the MCP database wait fails safely within ten seconds and releases its work", async () => {
	expect(result.status).toBe(503);
	expect(result.body).toEqual({ error: "service_unavailable" });
	expect(result.elapsed).toBeLessThan(11000);
	expect(result.workReleased).toBe(true);
});
