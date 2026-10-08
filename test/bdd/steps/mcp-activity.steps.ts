import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("an authenticated MCP activity call uses {word}", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("that call completes through the public MCP route", async ({ mcpWorld }) => {
	mcpWorld.result = flowProbe(String(mcpWorld.input?.mode));
});
Then("its activity records {word} without session or private target data", async ({ mcpWorld }, outcome: string) => {
	const records = (mcpWorld.result as any).activityRecords.filter((event: { outcome: string }) => event.outcome === outcome);
	expect(records).toHaveLength(1);
	expect(records[0].outcome).toBe(outcome);
	expect(records[0].actor_session_id).toBeNull();
	if (outcome === "denied") {
		expect(records[0].target_id).toBeNull();
		expect(records[0].metadata.creatorId).toBeUndefined();
	}
	expect(JSON.stringify(records)).not.toMatch(/private-input-value|private-foreign-secret|Bearer/);
});

Given("a creator activity viewer has {word} access", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("the viewer requests creator MCP activity", async ({ mcpWorld }) => {
	mcpWorld.result = runMcpProbe("activity-list-probe", [String(mcpWorld.input?.mode)]);
});
Then("the activity result is {word} and private payloads remain hidden", async ({ mcpWorld }, outcome: string) => {
	const value = mcpWorld.result as any;
	expect(value.available).toBe(true);
	if (outcome === "denied") {
		expect(value.error).toBe("ACCESS_DENIED");
		expect(value.result).toBeNull();
	} else {
		expect(value.error).toBeNull();
		expect(value.result.items).toHaveLength(2);
		expect(JSON.stringify(value.result)).not.toMatch(/private-payload-value|private-token|rawInput|secret|Private creator/);
	}
});
