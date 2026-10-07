import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the actual isolated provider returns {string} refresh metadata", async ({}, value: string) => {
	mode = value;
});
When("Better Auth refreshes the expired creator credential", async () => {
	result = runMcpProbe("provider-response-probe", [mode], 20000);
});
Then("only valid refresh metadata may replace stored credentials and coordination is released", async () => {
	expect(result.status).toBe(503);
	expect(result.body).toEqual({ error: "service_unavailable" });
	expect(result.completed).toBe(mode === "success");
	expect(result.refreshes).toBe(1);
	expect(result.lockReleased).toBe(true);
	expect(result.storedAccess).toBe(true);
	expect(result.storedRefresh).toBe(true);
});
