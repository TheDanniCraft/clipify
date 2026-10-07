import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe, flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a registration caller exhausts its configured registration budget", async ({ mcpWorld }) => {
	mcpWorld.input = { kind: "registration" };
});
When("it submits another registration", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: runMcpProbe("registration-rate-probe", []) };
});
Then("registration is throttled with retry guidance and no client record is created", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.results.map((value: any) => value.status)).toEqual([201, 201, 429]);
	expect(result.clients).toBe(2);
	expect(Number(result.results[2].retryAfter)).toBeGreaterThan(0);
});
Given("a client exhausts its configured tool-call budget", async ({ mcpWorld }) => {
	mcpWorld.input = { kind: "call" };
});
When("it attempts another mutation", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:overlay-create:rate-limit") };
});
Then("the call is throttled with retry guidance and no business resource changes", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.protocolStatus).toBe(200);
	expect(result.toolReplayStatus).toBe(429);
	expect(Number(result.replayRetryAfter)).toBeGreaterThan(0);
	expect(result.resourceCount).toBe(1);
});
