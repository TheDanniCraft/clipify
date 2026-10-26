import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Then("the named destination deletion is {string} with references preserved", async ({ mcpWorld }, outcome: string) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.deleteAvailable).toBe(true);
	expect(result.attempted).toMatchObject({ success: outcome === "deleted", ...(outcome === "blocked" ? { code: "RESOURCE_IN_USE" } : {}) });
	expect(result.reopened.destinations).toHaveLength(outcome === "deleted" ? 0 : 1);
	if (outcome === "blocked") {
		expect(result.unchanged).toBe(true);
		expect(result.attempted.references.sessions).toHaveLength(1);
		expect(result.sessionReferences).toBe(1);
	}
	expect(result.safe).toBe(true);
});
Given("a Pro creator saves a named Runner destination with a protected key", async ({ mcpWorld }) => {
	mcpWorld.input = { destinationVariant: "destinations_editor" };
});
When("they reopen the named destination editor", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:${mcpWorld.input?.destinationVariant}`) };
});
Then("its credential is configured and keep replace and clear actions are available without exposing secrets", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.saved.success).toBe(true);
	expect(result.reopened).toMatchObject({ success: true, destinations: [{ name: "My Twitch", credentialConfigured: true, credentialActions: ["keep", "replace", "clear"] }] });
	expect(result.safe).toBe(true);
});
Given("a Pro creator submits the named destination change {string}", async ({ mcpWorld }, variant: string) => {
	mcpWorld.input = { destinationVariant: `destinations_${variant}` };
});
When("they submit that named destination edit", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:${mcpWorld.input?.destinationVariant}`) };
});
Then("the edit is rejected and the prior destination and credential remain unchanged", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.unchanged).toBe(true);
	expect(result.reopened.destinations).toHaveLength(1);
	expect(result.reopened.destinations[0]).toMatchObject({ name: "My Twitch", credentialConfigured: true });
	expect(result.safe).toBe(true);
});
Then("the named credential change {string} succeeds without exposing secrets", async ({ mcpWorld }, variant: string) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.reopened.destinations).toHaveLength(1);
	expect(result.reopened.destinations[0]).toMatchObject({ credentialConfigured: variant !== "clear" });
	if (variant === "clear") expect(result.clearedStart.result?.structuredContent?.error?.code).toBe("INVALID_INPUT");
	expect(result.safe).toBe(true);
});

Then("the legacy broadcast exposes one reusable destination without revealing its key", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.second).toMatchObject({ success: true });
	expect(result.reopened.destinations).toHaveLength(1);
	expect(result.reopened.destinations[0]).toMatchObject({ credentialConfigured: true, credentialRevision: 1 });
	expect(result.safe).toBe(true);
});

Then("failed legacy MCP conversion preserves the previous public configuration", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.readAfter).toMatchObject({ configurationRevision: 1 });
	expect(result.reopened.destinations).toHaveLength(0);
	expect(result.safe).toBe(true);
});

Then("the named editor retains the newer destination and its protected credential", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.reopened.destinations).toMatchObject([{ name: "Authoritative destination", provider: "custom", credentialConfigured: true, credentialRevision: 2, configurationRevision: 2 }]);
	expect(result.safe).toBe(true);
});
