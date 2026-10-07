import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: ReturnType<typeof runMcpProbe>;
Given("twenty concurrent AI operations need cached creator provider credentials", async () => {});
When("they read those credentials through serialized Better Auth access", async () => {
	result = runMcpProbe("provider-concurrency-probe", [], 60000);
});
Then("all credential reads finish promptly and release their lock without exhausting database work", async () => {
	expect(result.successes).toBe(20);
	expect(result.failures).toBe(0);
	expect(result.elapsed).toBeLessThan(5000);
	expect(result.reads).toBe(20);
	expect(result.lockReleased).toBe(true);
	expect(result.healthy).toBe(true);
});
