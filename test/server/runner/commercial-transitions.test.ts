/** @jest-environment node */
import { applyDowngradeEffects, deriveDowngradeEffects } from "@/server/entitlements";
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US5-FR022 U22: an expired benefit retains its active captured window but drains it at its immutable end", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_scheduled");
	expect(result.established).toBe(1);
	expect(result.beforeEndState).toBe("running");
	expect(result.signedEnd).toBe(result.capturedEnd);
	expect(result.afterEndState).toBe("stopped");
	expect(result.afterAdmissionState).toBe("draining");
	expect(result.captureRetained).toBe(true);
	expect(result.settingsRetained).toBe(true);
});

test("TDD-US5-OPT075 U115: closing only one of two grandfathered broadcasts cannot release Free admission", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_many");
	expect(result.established).toBe(2);
	expect(result.beforeAckCode).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.occupiedBeforeAck).toBe(2);
	expect(result.betweenCode).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.remainingBeforeLastAck).toBe(1);
	expect(result.closedOriginalGeneration).toBe(true);
	expect(result.basicAccepted).toBe(true);
	expect(result.finalOccupied).toBe(1);
	expect(result.freeAdmissionPaid).toBe(false);
	expect(result.settingsRetained).toBe(true);
});

test("TDD-US5-EC013 U35: entitlement reconciliation preserves admitted manual generations and saved settings", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_multiple");
	expect(result.established).toBe(2);
	expect(result.reconciled).toMatchObject({ runners: 0, sessions: 0 });
	expect(result.afterSessions).toEqual(result.beforeSessions);
	expect(result.afterAdmissions).toEqual(result.beforeAdmissions);
	expect(result.runnersOnline).toBe(3);
	expect(result.settingsRetained).toBe(true);
});

test("TDD-US5-OPT074 U114: one grandfathered broadcast occupies Free admission until matching output closure", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_single");
	expect(result.established).toBe(1);
	expect(result.beforeAckCode).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.occupiedBeforeAck).toBe(1);
	expect(result.stopAccepted).toBe(true);
	expect(result.closedOriginalGeneration).toBe(true);
	expect(result.basicAccepted).toBe(true);
	expect(result.finalOccupied).toBe(1);
	expect(result.freeAdmissionPaid).toBe(false);
	expect(result.settingsRetained).toBe(true);
});

test("TDD-US5-OPT073 U113: expiry with no output retains a scheduled configuration but cannot admit its paid Start", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:transition_service_zero");
	expect(result.established).toBe(0);
	expect(result.paidDenied?.error?.code).toBe("FEATURE_RESTRICTED");
	expect(result.paidStartUnchanged).toBe(true);
	expect(result.paidAdmissions).toBe(0);
	expect(result.paidSuccessAudits).toBe(0);
	expect(result.basicAccepted).toBe(true);
	expect(result.basicAdmissionPaid).toBe(false);
	expect(result.settingsRetained).toBe(true);
});

test("TDD-US5-SC005 U40: downgrade preserves saved Runner configuration and basic control without forced runtime suspension", async () => {
	const inventory = { overlays: ["overlay"], playlists: ["playlist"], galleries: [], runners: ["runner"] };
	const saved = structuredClone(inventory);
	const effects = deriveDowngradeEffects({ inventory, effectivePlan: "free", runnerAccess: false });
	expect(effects.capabilities.runnerControl).toBe(true);
	expect(effects.retained).toEqual(saved);
	expect(effects.deleted).toEqual({ overlays: [], playlists: [], galleries: [], runners: [] });
	expect(effects.restrictions).not.toContain("runner-control-disabled");
	const deleteResource = jest.fn(),
		pauseRuntime = jest.fn(),
		markReconciled = jest.fn();
	await applyDowngradeEffects(effects, { deleteResource, pauseRuntime, markReconciled });
	expect(deleteResource).not.toHaveBeenCalled();
	expect(pauseRuntime).not.toHaveBeenCalled();
	expect(markReconciled).toHaveBeenCalledTimes(1);
	expect(inventory).toEqual(saved);
});
