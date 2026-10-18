import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("a creator with signed paid Runner access before a known expiry", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "owner_snapshot" };
});
When("the device refreshes its owner policy at expiry", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_owner_snapshot") };
});
Then("its verified owner policy requires Free presentation while its accepted manual generation continues", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.snapshotPresent).toBe(true);
	expect(result.cacheAvailable).toBe(true);
	expect(result.cachedAccepted).toBe(true);
	expect(result.cachedPaidBefore).toBe(true);
	expect(result.cachedPaidAfter).toBe(false);
	expect(result.cachedScope).toMatchObject({ ownerId: "fixture-creator", runnerId: expect.any(String) });
	expect(result.beforePolicy).toMatchObject({ runnerPro: true, attributionRequired: false, validUntil: result.knownEnd });
	expect(result.afterPolicy).toMatchObject({ runnerPro: false, attributionRequired: true, scheduling: false, customStandby: false });
	expect(result.ownerBound).toBe(true);
	expect(result.runnerBound).toBe(true);
	expect(result.acceptedStillActive).toBe(true);
	expect(result.lateContinuation).toBe(true);
});

Given("a creator with bounded Runner benefits and a newly signed manual Start", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "known_expiry" };
});
When("the known benefit deadline passes before its active acknowledgment arrives", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_known_expiry") };
});
Then("no new paid Start is authorized and the already accepted generation can acknowledge continuation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.capturedValidity).toBe(result.knownEnd);
	expect(result.permitExpiresAt).toBe(result.knownEnd);
	expect(result.delayedStartAccepted).toBe(false);
	expect(result.expiredFreshPermit).toBe(false);
	expect(result.pendingBound).toBe(true);
	expect(result.occupied).toBe(1);
	expect(result.acceptedStillActive).toBe(true);
	expect(result.lateAckAccepted).toBe(true);
	expect(result.lateContinuation).toBe(true);
});

Given("a Pro creator with an accepted active Scheduled window", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "scheduled" };
});
When("Pro expires before the captured window ends", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_scheduled") };
});
Then("the window stays active until its signed end and requests graceful drain at that end", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.established).toBe(1);
	expect(result.beforeEndState).toBe("running");
	expect(result.signedEnd).toBe(result.capturedEnd);
	expect(result.localAtEnd).toBe("draining");
	expect(result.afterEndState).toBe("stopped");
	expect(result.afterCommand).toBe("drain");
	expect(result.stopMode).toBe("graceful");
	expect(result.captureRetained).toBe(true);
	expect(result.settingsRetained).toBe(true);
});

Given("a Pro creator with two active manual broadcasts", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "many" };
});
When("Pro expires and they close each broadcast in turn", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_many") };
});
Then("closing only the first broadcast keeps new Free admission blocked", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.established).toBe(2);
	expect(result.occupiedBeforeAck).toBe(2);
	expect(result.betweenCode).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.remainingBeforeLastAck).toBe(1);
	expect(result.closedOriginalGeneration).toBe(true);
	expect(result.basicAccepted).toBe(true);
	expect(result.finalOccupied).toBe(1);
	expect(result.freeAdmissionPaid).toBe(false);
	expect(result.settingsRetained).toBe(true);
	expect(result.safe).toBe(true);
});

Given("a Pro creator with two admitted manual broadcasts", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "multiple" };
});

Given("a Pro creator with one active manual broadcast", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "single" };
});
When("Pro expires and they Stop that broadcast", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_single") };
});
Then("a matching closed-generation receipt releases it for one new Free broadcast", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.established).toBe(1);
	expect(result.beforeAckCode).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.occupiedBeforeAck).toBe(1);
	expect(result.closedOriginalGeneration).toBe(true);
	expect(result.basicAccepted).toBe(true);
	expect(result.finalOccupied).toBe(1);
	expect(result.freeAdmissionPaid).toBe(false);
	expect(result.settingsRetained).toBe(true);
	expect(result.safe).toBe(true);
});

Given("a Pro creator with saved Scheduled control and no active broadcasts", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "zero" };
});
When("their Pro access expires before a new Scheduled Start", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_zero") };
});
Then("the paid Start is denied and one basic manual broadcast remains available", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.established).toBe(0);
	expect(result.paidDenied?.result?.structuredContent?.error?.code).toBe("FEATURE_RESTRICTED");
	expect(result.paidAdmissions).toBe(0);
	expect(result.basicAccepted).toBe(true);
	expect(result.settingsRetained).toBe(true);
	expect(result.safe).toBe(true);
});
When("their Pro access expires and entitlement reconciliation runs", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_multiple") };
});
Then("their existing broadcasts remain commanded online and a third broadcast is denied", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.established).toBe(2);
	expect(result.jobs.map((job: any) => job.desiredState)).toEqual(["running", "running"]);
	expect(result.jobs.every((job: any) => job.signed && job.originalGeneration)).toBe(true);
	expect(result.denied.result?.structuredContent?.error?.code).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.occupied).toBe(2);
	expect(result.thirdState).toBe("stopped");
	expect(result.settingsRetained).toBe(true);
	expect(result.safe).toBe(true);
});

Given("a paid reservation whose Runner grant is revoked before first dispatch", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "revoked_before_dispatch" };
});
When("the device requests its first execution permission after revocation", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_revoked_before_dispatch") };
});
Then("it receives no paid permission and another basic manual admission is available", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.capturedPaid).toBe(true);
	expect(result.freshPaidPermit).toBe(false);
	expect(result.dispatched).toBe(false);
	expect(result.admissionState).toBe("failed_before_output");
	expect(result.nextAccepted).toBe(true);
});

Given("a paid execution dispatched before Runner grant revocation", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "revoked_after_dispatch" };
});
When("the device polls after revocation before acknowledging its accepted output", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_revoked_after_dispatch") };
});
Then("the generation retains occupancy without a fresh permit and may acknowledge continuation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.pendingBound).toBe(true);
	expect(result.freshPaidPermit).toBe(false);
	expect(result.occupied).toBe(1);
	expect(["RUNNER_RECOVERY_REQUIRED", "RUNNER_CONCURRENCY_LIMIT"]).toContain(result.secondCode);
	expect(result.lateAckAccepted).toBe(true);
	expect(result.lateContinuation).toBe(true);
});

Given("a paid manual Start awaiting acknowledgment when its known benefit expires", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "renewed_pending" };
});
When("Runner access is renewed and the same Start is retried", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_renewed_pending") };
});
Then("fresh permission uses renewed validity and the original generation and captured history remain", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.validFreshPermit).toBe(true);
	expect(result.freshExpiry).toBe(result.expectedExpiry);
	expect(result.sameGeneration).toBe(true);
	expect(result.localRenewalAccepted).toBe(true);
	expect(result.capturedHistorySame).toBe(true);
	expect(result.repeatAccepted).toBe(true);
	expect(result.admissions).toBe(1);
});

Given("a Runner owner with a month-long benefit and a seven-day signed policy snapshot", async ({ mcpWorld }) => {
	mcpWorld.input = { transition: "owner_long_refresh" };
});
When("their device refreshes policy before the first snapshot expires", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:transition_workflow_owner_long_refresh") };
});
Then("paid features continue beyond seven days and end at the original known benefit deadline", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.firstAccepted).toBe(true);
	expect(result.firstHorizon).toBe(604800000);
	expect(result.refreshAccepted).toBe(true);
	expect(result.paidAfterFirstHorizon).toBe(true);
	expect(result.lastAccepted).toBe(true);
	expect(result.paidBeforeKnownEnd).toBe(true);
	expect(result.paidAtKnownEnd).toBe(false);
});
