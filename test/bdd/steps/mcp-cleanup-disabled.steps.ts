import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("public MCP is disabled with {string} database readiness", async ({}, schema: string) => {
	mode = schema;
});
When("the background privacy cleanup worker runs", async () => {
	result = runMcpProbe("cleanup-disabled-probe", [mode]);
});
Then("ready schema removes expired MCP activity and legacy schema stays untouched while the endpoint remains disabled", async () => {
	expect(result.remaining).toEqual(mode === "ready" ? ["disabled-2", "disabled-3"] : ["disabled-1", "disabled-2", "disabled-3"]);
	expect(result.serviceStatus).toBe(503);
	expect(result.finished).toBe(true);
	expect(result.healthy).toBe(true);
	if (mode === "ready") expect(result.started).toBe(true);
});
