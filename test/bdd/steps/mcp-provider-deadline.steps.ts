import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the isolated Twitch refresh service has {string} behavior", async ({}, value: string) => {
	mode = value;
});
When("Clipify needs fresh Twitch credentials during an MCP request", async () => {
	result = runMcpProbe("provider-deadline-probe", [mode], 30000);
});
Then("the request finishes within the dependency deadline and releases its credential lock with valid stored tokens", async () => {
	expect(result.status).toBe(503);
	expect(result.body).toEqual({ error: "service_unavailable" });
	expect(result.elapsed).toBeLessThan(11000);
	expect(result.lockReleased).toBe(true);
	expect(result.completed).toBe(mode === "success");
	expect(result.refreshes).toBe(1);
	expect(result.storedAccess).toBe(true);
	expect(result.storedRefresh).toBe(true);
});
