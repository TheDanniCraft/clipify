import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let operation: string;
let authority: string;
let result: ReturnType<typeof runMcpProbe>;
Given("an AI playlist item {string} waits with {string} authority", async ({}, action: string, expiry: string) => {
	operation = action;
	authority = expiry;
});
When("the playlist lock is released after the authority boundary", async () => {
	result = runMcpProbe("playlist-item-expiry-probe", [operation, authority]);
});
Then("expired authority preserves playlist items revision and audit while active authority commits the item change", async () => {
	expect(result.waited).toBe(true);
	expect(result.success).toBe(authority === "active");
	expect(result.error).toBe(authority === "active" ? null : "AUTHENTICATION_REQUIRED");
	expect(result.current).toEqual({ name: "Before", configuration_revision: authority === "active" ? 2 : 1 });
	expect(result.audits).toBe(authority === "active" ? 1 : 0);
	const ids = authority !== "active" ? ["clip-a", "clip-b"] : operation === "reorder" ? ["clip-b", "clip-a"] : ["clip-b"];
	expect(result.items).toEqual(ids.map((clip_id, position) => ({ clip_id, position })));
});
