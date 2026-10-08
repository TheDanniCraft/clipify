import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd(test);
When("an authenticated MCP client pauses an active overlay", async ({ mcpWorld }) => {
	mcpWorld.result = flowProbe("resources:overlay-update:pause");
});
When("an authenticated MCP client submits a stale pause", async ({ mcpWorld }) => {
	mcpWorld.result = flowProbe("resources:overlay-update:pause:stale");
});
Then("its connected local source is stopped", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.resourceResult.overlay.status).toBe("paused");
	expect(r.sourceCloses).toEqual([4002]);
	expect(r.sourceActive).toBe(false);
});
Then("its connected local source remains active", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.resourceResult.error.code).toBe("CONFLICT");
	expect(r.sourceCloses).toEqual([]);
	expect(r.sourceActive).toBe(true);
});
