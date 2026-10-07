import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("a browser overlay {string} request has {string} authority", async ({ mcpWorld }, operation: string, mode: string) => {
	expect(["list", "get", "editor"]).toContain(operation);
	expect(["owner", "removed", "read-denied", "read-only", "allowed"]).toContain(mode);
	mcpWorld.input = { mode: `overlay-${operation}-${mode}` };
});
When("the verified browser requests the overlay records", async ({ mcpWorld }) => {
	const result = runMcpProbe("browser-playlist-delete-probe", [String(mcpWorld.input?.mode)]);
	mcpWorld.result = { status: 200, body: result };
});
Then("browser overlay records are {string} with the correct owner boundary", async ({ mcpWorld }, availability: string) => {
	expect(["available", "unavailable", "empty"]).toContain(availability);
	expect(mcpWorld.result?.body.listObservation).toEqual(availability === "available" ? { available: true, count: 1, ownerIds: ["creator"], ownerSecretPresent: true } : { available: availability === "empty", count: 0, ownerIds: [], ownerSecretPresent: false });
});
