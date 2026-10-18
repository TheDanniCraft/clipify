/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US1-FR005: Free manual fallback configuration preserves encrypted credentials and does not activate scheduling or output", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_fallback");
	expect(result.ownerFree).toBe(true);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.capabilityAllowed).toBe(true);
	expect(result.mcpAccepted).toBe(true);
	expect(result.browser).toMatchObject({ success: true });
	expect(result.sessions).toBe(1);
	expect(result.configuration).toEqual({ mode: "failsafe", controlMode: "manual", desiredState: "stopped", actualState: "stopped", configurationRevision: 2 });
	expect(result.credentialEncrypted).toBe(true);
	expect(result.schedulingAvailable).toBe(false);
	expect(result.safe).toBe(true);
});

test("TDD-US1-FR005: Free manual availability cannot be used to enable paid scheduling through either authenticated entry", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_scheduled_denied");
	expect(result.ownerFree).toBe(true);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.capabilityAllowed).toBe(true);
	expect(result.mcpAccepted).toBe(false);
	expect(result.mcpError).toBe("FEATURE_RESTRICTED");
	expect({ returned: result.businessDenialReturned, thrown: result.businessDenialThrownCode }).toEqual({ returned: true, thrown: null });
	expect(result.browser).toMatchObject({ success: false, code: "ENTITLEMENT_REQUIRED" });
	expect(result.sessions).toBe(0);
	expect(result.configuration).toBeNull();
	expect(result.safe).toBe(true);
});

test("TDD-US1-FR005: Live fallback cannot be scheduled even when the owner has Pro", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_fallback_scheduled_invalid");
	expect(result.ownerFree).toBe(false);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.capabilityAllowed).toBe(true);
	expect(result.mcpAccepted).toBe(false);
	expect(result.mcpError).toBe("INVALID_INPUT");
	expect(result.browser).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.sessions).toBe(0);
	expect(result.configuration).toBeNull();
});

test("TDD-US1-FR005: Pro can save Scheduled clip control without granting unrelated output or starting a broadcast", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_pro_clip_scheduled");
	expect(result.ownerFree).toBe(false);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.capabilityAllowed).toBe(true);
	expect(result.mcpAccepted).toBe(true);
	expect(result.browser).toMatchObject({ success: true });
	expect(result.sessions).toBe(1);
	expect(result.configuration).toEqual({ mode: "24/7", controlMode: "scheduled", desiredState: "stopped", actualState: "stopped", configurationRevision: 2 });
	expect(result.credentialEncrypted).toBe(true);
	expect(result.schedulingAvailable).toBe(true);
	expect(result.safe).toBe(true);
});

test.each(["same", "race", "draining", "edited"])("TDD-US1-FR005: Pro cannot open independent fallback ingest twice on one installation (%s)", (variant) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:manual_ingest_${variant}`);
	expect(result.transportErrors).toEqual([]);
	expect(result.accepted).toBe(1);
	expect(result.codes).toEqual(["RUNNER_INGEST_IN_USE"]);
	expect(result.occupied).toBe(1);
	expect(result.successfulStarts).toBe(1);
	if (variant !== "race") expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	if (variant === "draining") expect(result.resumedAfterClosure).toBe(true);
});

test.each(["different", "clip", "after_clip"])("TDD-US1-FR005: independent ingest restriction preserves Pro broadcasts (%s)", (variant) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:manual_ingest_${variant}`);
	expect(result.transportErrors).toEqual([]);
	expect(result.accepted).toBe(2);
	expect(result.codes).toEqual([]);
	expect(result.occupied).toBe(2);
	expect(result.successfulStarts).toBe(2);
});

test("TDD-US1-FR005: an omitted control mode cannot turn saved Scheduled clips into an invalid fallback pair", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_existing_scheduled_fallback");
	expect(result.ownerFree).toBe(false);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.mcpAccepted).toBe(true);
	expect(result.browser).toMatchObject({ success: true });
	expect(result.existingEdit).toMatchObject({ mcpCode: "INVALID_INPUT", browser: { success: false, code: "INVALID_INPUT" } });
	expect(result.configuration).toEqual({ mode: "24/7", controlMode: "scheduled", desiredState: "stopped", actualState: "stopped", configurationRevision: 2 });
	expect(result.credentialEncrypted).toBe(true);
});

test("TDD-US1-FR005: forged behavior values return input errors without touching storage", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_invalid_behavior");
	expect(result.ownerFree).toBe(true);
	expect(result.browserAuthenticated).toBe(true);
	expect(result.mcpError).toBe("INVALID_INPUT");
	expect(result.browser).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.sessions).toBe(0);
});
