import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("a creator with a lifetime Pro grant", async ({ mcpWorld }) => {
	mcpWorld.input = { commercialState: "lifetime" };
});
When("they request Scheduled Runner control through MCP", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:commercial_workflow_${mcpWorld.input?.commercialState}`) };
});
Then("their Scheduled control is saved and effective Pro controls are available", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.configured.result?.isError).not.toBe(true);
	expect(result.configured.result?.structuredContent).toMatchObject({ controlMode: "scheduled", desiredState: "stopped" });
	expect(result.rows).toEqual([{ control_mode: "scheduled", desired_state: "stopped", actual_state: "stopped" }]);
	expect(result.capability.result?.structuredContent?.operations?.pause_overlay).toMatchObject({ allowed: true });
	expect(result.unrelated.result?.isError, JSON.stringify(result.unrelated)).not.toBe(true);
	expect(result.safe).toBe(true);
});

Given("a creator with an active bounded Pro grant", async ({ mcpWorld }) => {
	mcpWorld.input = { commercialState: "active" };
});

Given("a Free creator with an expired Pro grant", async ({ mcpWorld }) => {
	mcpWorld.input = { commercialState: "expired" };
});
Then("Scheduled control is denied without saving a paid configuration or unrelated Pro access", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.configured.result?.isError).toBe(true);
	expect(result.configured.result?.structuredContent?.error?.code).toBe("FEATURE_RESTRICTED");
	expect(result.rows).toEqual([]);
	expect(result.capability.result?.structuredContent?.operations?.pause_overlay).toMatchObject({ allowed: false, reason: "FEATURE_RESTRICTED" });
	expect(result.unrelated.result?.structuredContent?.error?.code).toBe("FEATURE_RESTRICTED");
	expect(result.safe).toBe(true);
});

Given("a Free creator with a revoked Pro grant", async ({ mcpWorld }) => {
	mcpWorld.input = { commercialState: "revoked" };
});

Given("a creator with an active agency creator Pro allocation", async ({ mcpWorld }) => {
	mcpWorld.input = { commercialState: "agency_active" };
});

Given("a Free creator whose agency creator Pro allocation is {string}", async ({ mcpWorld }, state: string) => {
	if (!["past its end", "ended before its deadline"].includes(state)) throw new Error("Unknown agency lifetime fixture");
	mcpWorld.input = { commercialState: state === "past its end" ? "agency_ended" : "agency_ended_status" };
});
