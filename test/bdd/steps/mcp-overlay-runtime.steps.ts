import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd(test);
When("an existing overlay source sends a frame after {word}", async ({ mcpWorld }, change: string) => {
	mcpWorld.result = runMcpProbe("websocket-runtime-probe", [change]);
});
Then("the source is disconnected without broadcasting its frame", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.closes).toEqual([4002]);
	expect(r.messages).toEqual([]);
	expect(r.registered).toBe(false);
	expect(r.sourceActive).toBe(false);
	expect(r.activeOwners).toEqual([]);
});

When("an existing idle overlay source is checked after {word}", async ({ mcpWorld }, change: string) => {
	mcpWorld.result = runMcpProbe("websocket-runtime-probe", ["idle-" + change]);
});

When("an existing overlay source announces activity after {word}", async ({ mcpWorld }, change: string) => {
	mcpWorld.result = runMcpProbe("websocket-runtime-probe", ["activity-" + change]);
});
