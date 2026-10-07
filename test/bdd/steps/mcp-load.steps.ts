import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("twenty independent creators have one authorized custom app", async ({ mcpWorld }) => {
	mcpWorld.input = { loadMode: "benchmark:20" };
});
When("their real MCP reads and mutations execute after warmup", async ({ mcpWorld }) => {
	const result = runMcpProbe("flow-probe", [String(mcpWorld.input?.loadMode)], 90000);
	console.info("Isolated MCP BDD benchmark", JSON.stringify(result));
	mcpWorld.result = { status: 200, body: result };
});
Then("p95 reads finish within one second and mutations within two seconds without bypassing policies", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.settings).toMatchObject({ concurrency: 20, independentCreators: 20, warmupCalls: 40, measuredCalls: 40, samplesPerOperation: 20, poolMax: 10 });
	expect(result.readsMs).toHaveLength(20);
	expect(result.mutationsMs).toHaveLength(20);
	expect(result.rows).toEqual([{ configuration_revision: 3, count: 20 }]);
	expect(result.budget).toEqual([80]);
	expect(result.unexpectedNetworkCalls).toBe(0);
	expect(result.p95ReadMs).toBeLessThanOrEqual(1000);
	expect(result.p95MutationMs).toBeLessThanOrEqual(2000);
});
