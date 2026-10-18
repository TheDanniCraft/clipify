import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/runner-free-pro";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("a creator uses Free without a paid Runner benefit", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "free" };
});
When("they register two devices and complete the manual Runner protocol journey", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:${mcpWorld.input?.extended ? "free_acceptance_extended" : "free_acceptance"}`) };
});
Then("both devices are available but only one concurrent broadcast is admitted and its shutdown is confirmed", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.ownerFree).toBe(true);
	expect(result.registered).toBe(2);
	expect(result.configured).toBe(2);
	expect(result.advertised).toBe(true);
	expect(result.admitted).toBe(1);
	expect(result.denied).toEqual(["RUNNER_CONCURRENCY_LIMIT"]);
	expect(result.occupiedAfterStart).toBe(1);
	expect(result.leaseVerified).toBe(true);
	expect(result.activeConfirmed).toBe(true);
	expect(result.stopAccepted).toBe(true);
	expect(result.stopAppliedInitially).toBe(false);
	expect(result.drainDelivered).toBe(true);
	expect(result.stoppedConfirmed).toBe(true);
	expect(result.occupiedAfterStop).toBe(0);
	expect(result.sessionsStopped).toBe(true);
	expect(result.monthlyUsageLimit).toBeNull();
	expect(result.protocolErrors).toEqual([]);
	expect(result.safe).toBe(true);
});

Given("a Free broadcast has a long-running history across a calendar month", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "free", extended: true };
});
Then("the additional start is denied for concurrency while streaming time remains unlimited", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.ownerFree).toBe(true);
	expect(result.registered).toBe(2);
	expect(result.admitted).toBe(1);
	expect(result.extendedHours).toBeGreaterThanOrEqual(1000);
	expect(result.crossedMonth).toBe(true);
	expect(result.continuedSignedLease).toBe(true);
	expect(result.secondAttemptError).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.monthlyUsageLimit).toBeNull();
	expect(result.activeConfirmed).toBe(true);
	expect(result.stoppedConfirmed).toBe(true);
	expect(result.occupiedAfterStop).toBe(0);
	expect(result.protocolErrors).toEqual([]);
	expect(result.safe).toBe(true);
});
