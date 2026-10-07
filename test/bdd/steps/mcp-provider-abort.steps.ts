import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: ReturnType<typeof runMcpProbe>;
Given("Twitch refresh is in flight during an MCP request", async () => {});
When("the client cancels that request before Twitch responds", async () => {
	result = runMcpProbe("provider-abort-probe", []);
});
Then("the request is cancelled while Twitch refresh remains serialized and its rotated credentials are stored encrypted", async () => {
	expect(result.status).toBe(400);
	expect(result.lockHeldAfterAbort).toBe(true);
	expect(result.completed).toBe(true);
	expect(result.refreshes).toBe(1);
	expect(result.storedAccess).toBe(true);
	expect(result.storedRefresh).toBe(true);
});
