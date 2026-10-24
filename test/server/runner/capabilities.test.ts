/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US5-CON015 U276/U277: known validity bounds a new paid Start without ending accepted manual output", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_known_expiry");
	expect(result.capturedValidity).toBe(result.knownEnd);
	expect(result.permitExpiresAt).toBe(result.knownEnd);
	expect(result.delayedStartAccepted).toBe(false);
	expect(result.expiredFreshPermit).toBe(false);
	expect(result.pendingBound).toBe(true);
	expect(["RUNNER_RECOVERY_REQUIRED", "RUNNER_CONCURRENCY_LIMIT"]).toContain(result.secondCode);
	expect(result.occupied).toBe(1);
	expect(result.acceptedStillActive).toBe(true);
	expect(result.lateAckAccepted).toBe(true);
	expect(result.lateContinuation).toBe(true);
});

test.each([
	["lifetime", true, "grant"],
	["active", true, "grant"],
	["expired", false, "free"],
	["revoked", false, "free"],
	["agency_active", true, "agency"],
	["agency_ended", false, "free"],
	["agency_ended_status", false, "free"],
	["pro", true, "pro"],
	["trial", true, "trial"],
	["pro_grant", true, "grant"],
	["agency_creator", true, "agency"],
])("TDD-US5-CON015 U151: individual/bulk Runner metadata agree for %s", (state, runnerPro, source) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:commercial_metadata_${state}`);
	expect(result.available).toBe(true);
	expect(result.ownerResultsPresent).toBe(true);
	expect(result.individual).toEqual(result.batch);
	expect(result.individualPolicy).toEqual(result.batchPolicy);
	expect(result.individualPolicy).toMatchObject({ runnerPro, source, validUntil: result.expectedEnd });
	expect(result.otherPolicy).toMatchObject({ runnerPro: false, source: "free" });
	expect(result.historyUnchanged).toBe(true);
});

test.each(["lifetime", "active", "agency_active"])("TDD-US5-CON015 U275: %s Pro-source metadata agrees with general Pro", (state) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:commercial_metadata_${state}`);
	expect(result.available).toBe(true);
	expect(result.individual).toMatchObject({ proAccess: true });
	expect(result.individualPolicy).toMatchObject({ runnerPro: true, scheduling: true });
	expect(result.raw).toMatchObject({ effectivePlan: "pro", proAccess: true, isBillingPro: false });
	expect(result.historyUnchanged).toBe(true);
	expect(result.otherPolicy.runnerPro).toBe(false);
});

test("TDD-US5-CON015: revoked access before dispatch cannot authorize paid output or retain a never-opened slot", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_revoked_before_dispatch");
	expect(result.capturedPaid).toBe(true);
	expect(result.freshPaidPermit).toBe(false);
	expect(result.dispatched).toBe(false);
	expect(result.admissionState).toBe("failed_before_output");
	expect(result.nextAccepted).toBe(true);
});

test("TDD-US5-CON015: dispatched output retains occupancy after revocation and can acknowledge its accepted generation", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_revoked_after_dispatch");
	expect(result.pendingBound).toBe(true);
	expect(result.freshPaidPermit).toBe(false);
	expect(result.occupied).toBe(1);
	expect(["RUNNER_RECOVERY_REQUIRED", "RUNNER_CONCURRENCY_LIMIT"]).toContain(result.secondCode);
	expect(result.lateAckAccepted).toBe(true);
	expect(result.lateContinuation).toBe(true);
});

test.each([
	["billing_active", true],
	["billing_trialing", true],
	["billing_past_due", true],
	["billing_expired", false],
	["billing_canceled", false],
	["billing_unbounded", true],
])("TDD-US5-CON015: persisted %s policy respects its known period without changing billing history", (state, runnerPro) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:commercial_metadata_${state}`);
	expect(result.ownerResultsPresent).toBe(true);
	expect(result.individualPolicy).toEqual(result.batchPolicy);
	expect(result.individualPolicy).toEqual(result.defaultPolicy);
	expect(result.individualPolicy).toEqual(result.explicitBatchPolicy);
	expect(result.individualPolicy).toMatchObject({ runnerPro, validUntil: result.expectedEnd, source: runnerPro ? "pro" : "free" });
	expect(result.historyUnchanged).toBe(true);
	expect(result.otherPolicy.runnerPro).toBe(false);
	expect(result.emptyBatchSize).toBe(0);
});

test("TDD-US5-CON015: renewed access authorizes the pending generation using current validity without another admission", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_renewed_pending");
	expect(result.validFreshPermit).toBe(true);
	expect(result.freshExpiry).toBe(result.expectedExpiry);
	expect(result.sameGeneration).toBe(true);
	expect(result.localRenewalAccepted).toBe(true);
	expect(result.capturedHistorySame).toBe(true);
	expect(result.repeatAccepted).toBe(true);
	expect(result.admissions).toBe(1);
});
