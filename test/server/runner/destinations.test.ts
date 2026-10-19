/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US2-FR006 U6: a Pro admission captures both selected targets and protects their original credentials", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_pro");
	expect(result.authenticated).toBe(true);
	expect(result.destinationsSaved).toBe(2);
	expect(result.configurationAccepted).toBe(true);
	expect(result.selectedIds).toEqual(result.expectedIds);
	expect(result.admitted).toBe(true);
	expect(result.publicSelection).toEqual(result.expectedIds);
	expect(result.publicReadSafe).toBe(true);
	expect(result.allPublicReadSafe).toBe(true);
	expect(result.publicMcpSelection).toEqual(result.expectedIds);
	expect(result.snapshotIds).toEqual(result.expectedSnapshotIds);
	expect(result.snapshotEncrypted).toBe(true);
	expect(result.snapshotPreserved).toBe(true);
	expect(result.dispatchedOriginal).toBe(true);
	expect(result.signatureVerified).toBe(true);
	expect(result.publicSafe).toBe(true);
});

test("TDD-US2-FR006 U6: Free cannot save a multiple-target configuration or leave a partial broadcast", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_free");
	expect(result.authenticated).toBe(true);
	expect(result.destinationsSaved).toBe(2);
	expect(result.configurationAccepted).toBe(false);
	expect(result.configurationError).toBe("RUNNER_TARGET_LIMIT");
	expect(result.sessions).toBe(0);
});

test("TDD-US2-FR007 U7: two Pro devices capture distinct admissions and stopping one preserves the other", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_independent_state");
	expect(result.authenticated).toBe(true);
	expect(result.configurationAccepted).toBe(true);
	expect(result.bothAdmitted).toBe(true);
	expect(result.distinctGenerations).toBe(true);
	expect(result.allCapturedPro).toBe(true);
	expect(result.assignedOnly).toBe(true);
	expect(result.stopIndependent).toBe(true);
});

test("TDD-US2-FR006 U6: the dashboard saves the same protected selection without receiving or resubmitting keys", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_dashboard");
	expect(result.authenticated).toBe(true);
	expect(result.configurationAccepted).toBe(true);
	expect(result.selectedIds).toEqual(result.expectedIds);
	expect(result.admitted).toBe(true);
	expect(result.snapshotPreserved).toBe(true);
	expect(result.dispatchedOriginal).toBe(true);
	expect(result.publicSafe).toBe(true);
});

test.each([
	{ id: "TDD-US2-OPT010", provider: "youtube" },
	{ id: "TDD-US2-OPT011", provider: "twitch" },
	{ id: "TDD-US2-OPT012", provider: "custom" },
])("$id: the selected $provider target retains its identity and protected credential through admission", ({ provider }) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:multistream_provider_${provider}`);
	expect(result.authenticated).toBe(true);
	expect(result.destinationsSaved).toBe(1);
	expect(result.configurationAccepted).toBe(true);
	expect(result.selectedIds).toEqual(result.expectedIds);
	expect(result.admitted).toBe(true);
	expect(result.snapshotEncrypted).toBe(true);
	expect(result.snapshotPreserved).toBe(true);
	expect(result.dispatchedOriginal).toBe(true);
	expect(result.signatureVerified).toBe(true);
	expect(result.publicSafe).toBe(true);
});

test.each([
	{ variant: "duplicate", code: "INVALID_INPUT" },
	{ variant: "missing", code: "RESOURCE_UNAVAILABLE" },
	{ variant: "foreign", code: "RESOURCE_UNAVAILABLE" },
	{ variant: "rollback", code: "SERVICE_UNAVAILABLE" },
	{ variant: "empty_internal", code: "INVALID_INPUT" },
	{ variant: "malformed_internal", code: "INVALID_INPUT" },
])("TDD-US2-FR006: $variant selection fails without creating a partial broadcast", ({ variant, code }) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:multistream_selection_${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.configurationAccepted).toBe(false);
	expect(result.configurationError).toBe(code);
	expect(result.sessions).toBe(0);
});

test.each(["multistream_active_reassignment", "multistream_active_reassignment_legacy"])("TDD-US2-FR006: %s preserves the active broadcast's assigned device", (variant) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.configurationAccepted).toBe(true);
	expect(result.reassignmentError).toBe("CONFLICT");
	expect(result.originalDevicePreserved).toBe(true);
	expect(result.revisionPreserved).toBe(true);
});

test("TDD-US2-FR006: globally scoped owned destinations may be selected and captured", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_selection_global");
	expect(result.configurationAccepted).toBe(true);
	expect(result.selectedIds).toEqual(result.expectedIds);
	expect(result.admitted).toBe(true);
	expect(result.snapshotPreserved).toBe(true);
	expect(result.dispatchedOriginal).toBe(true);
	expect(result.signatureVerified).toBe(true);
});

test("TDD-US2-FR006: a closed broadcast may move to another device without losing global destinations", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_inactive_reassignment");
	expect(result.configurationAccepted).toBe(true);
	expect(result.inactiveReassignmentAllowed).toBe(true);
	expect(result.movedRunner).toBe(true);
});

test("TDD-US2-FR009 baseline: unsafe persisted destination URLs fail an edit without rewriting credentials or revision", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_persisted_control_url");
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.unchanged).toBe(true);
	expect(result.credentialPreserved).toBe(true);
	expect(result.revision).toBe(1);
	expect(result.safe).toBe(true);
});
