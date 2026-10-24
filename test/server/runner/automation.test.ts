/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

let observation: any;
const observe = () => (observation ??= flowProbe("catalogue:workflow:runner_free_pro:schedule_automation"));

test("TDD-US3-OPT088: Pause atomically retains the saved event and Scheduled control while removing future start authority", () => {
	const result = observe();
	expect(result.authenticated).toBe(true);
	expect(result.saved).toMatchObject({ success: true });
	expect(result.before).toMatchObject({ success: true, occurrences: [expect.objectContaining({ sessionId: expect.any(String) })] });
	expect(result.pause).toMatchObject({ success: true });
	expect(result.session).toMatchObject({ control_mode: "scheduled", configuration_revision: 1, automation_revision: 1, desired_state: "stopped" });
	expect(result.session.automation_paused_at).not.toBeNull();
	expect(result.deviceAfter).toBe(result.deviceBefore + 1);
	expect(result.after).toMatchObject({ success: true, occurrences: [] });
	expect(result.retained).toMatchObject({ success: true, events: [expect.objectContaining({ title: "Retained automation event" })] });
});

test("TDD-US3-OPT088: stale or unavailable automation controls leave persisted authority unchanged", () => {
	const result = observe();
	expect(result.pause.success).toBe(true);
	expect(result.stale).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.staleUnchanged).toBe(true);
	expect(result.missing).toMatchObject({ success: false, code: "RESOURCE_UNAVAILABLE" });
	expect(result.missingUnchanged).toBe(true);
});

test("TDD-US3-OPT088: repeating Pause is idempotent and Resume restores future scheduling without changing media intent", () => {
	const result = observe();
	expect(result.repeat.success).toBe(true);
	expect(result.repeatUnchanged).toBe(true);
	expect(result.deviceAfterRepeat).toBe(result.deviceAfter);
	expect(result.resume.success).toBe(true);
	expect(result.resumedSession).toEqual({ control_mode: "scheduled", configuration_revision: 1, automation_revision: 2, automation_paused_at: null, desired_state: "stopped" });
	expect(result.deviceAfterResume).toBe(result.deviceAfter + 1);
	expect(result.resumedSnapshot).toMatchObject({ success: true, occurrences: [expect.objectContaining({ sessionId: expect.any(String) })] });
});

test.each([
	["read_only", "ACCESS_DENIED"],
	["manual_mode", "INVALID_INPUT"],
	["fallback_mode", "INVALID_INPUT"],
	["foreign_runner", "RESOURCE_UNAVAILABLE"],
	["stale_media", "CONFLICT"],
	["extra_field", "INVALID_INPUT"],
])("TDD-US3-OPT088: %s cannot change session, device authority or successful audit state", (vector, code) => {
	expect(observe().safetyControls[vector]).toMatchObject({ result: { success: false, code }, unchanged: true });
});
test("TDD-US3-OPT088: an owner without Pro can safely Pause retained automation but cannot Resume it", () => {
	expect(observe().safetyControls.free_pause).toMatchObject({ result: { success: true, automation: { automationRevision: 3, controlMode: "scheduled", desiredState: "stopped" } }, freeResume: { success: false, code: "FEATURE_RESTRICTED" }, unchanged: true });
});
