import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let authority: string;
let result: ReturnType<typeof runMcpProbe>;
Given("AI clip addition uses creator credentials and waits with {string} authority", async ({}, expiry: string) => {
	authority = expiry;
});
When("the playlist becomes available after that addition authority boundary", async () => {
	result = runMcpProbe("playlist-add-expiry-probe", [authority]);
});
Then("expired authority preserves items revision and audit while active authority appends the validated clip", async () => {
	expect(result.waited).toBe(true);
	expect(result.providerCalls).toBe(1);
	expect(result.credentialUsed).toBe(true);
	expect(result.success).toBe(authority === "active");
	expect(result.error).toBe(authority === "active" ? null : "AUTHENTICATION_REQUIRED");
	expect(result.current).toEqual({ name: "Before", configuration_revision: authority === "active" ? 2 : 1 });
	expect(result.audits).toBe(authority === "active" ? 1 : 0);
	const ids = authority === "active" ? ["clip-a", "clip-b", "NewClip"] : ["clip-a", "clip-b"];
	expect(result.items).toEqual(ids.map((clip_id, position) => ({ clip_id, position })));
});
