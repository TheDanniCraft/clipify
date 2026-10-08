import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: ReturnType<typeof runMcpProbe>;
Given("two native provider credential coordinators occupy available admission", async () => {});
When("a third credential operation waits beyond its dependency deadline", async () => {
	result = runMcpProbe("provider-queue-probe", [], 30000);
});
Then("its callback never executes and subsequent credential work can acquire released capacity", async () => {
	expect(result.elapsed).toBeGreaterThanOrEqual(9900);
	expect(result.elapsed).toBeLessThan(11000);
	expect(result.error).toBe("PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE");
	expect(result.queuedRuns).toBe(0);
	expect(result.retry).toBe("retry-ok");
	expect(result.healthyWhileHeld).toBe(true);
	expect(result.allLocksReleased).toBe(true);
});
