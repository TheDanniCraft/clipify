/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
let observation: any;
const observe = () => (observation ??= flowProbe("catalogue:workflow:runner_free_pro:schedule_continuity"));

test("TDD-US3-OPT046: refreshing an active session retains its authorized adjacent calendar window", () => {
	const result = observe();
	expect(result.authenticated).toBe(true);
	expect(result.firstActive).toHaveLength(1);
	expect(result.initialCount).toBe(2);
	expect(result.refreshedIds.sort()).toEqual(result.originalIds.slice().sort());
});

test("TDD-US3-OPT046: two adjacent logical members reconcile one continuing session without a false closure", () => {
	const result = observe();
	expect(result.secondActive).toEqual([expect.objectContaining({ admissionId: result.originalIds[1], state: "active" })]);
	expect(result.states).toMatchObject([
		{ id: result.originalIds[0], state: "active", stopped_at: null, continuity_root: null },
		{ id: result.originalIds[1], state: "active", stopped_at: null, continuity_root: result.originalIds[0] },
	]);
	expect(result.afterRepeat).toEqual(result.states);
	expect(Date.parse(result.states[0].scheduled_end)).toBe(result.firstEnd);
	expect(Date.parse(result.states[1].scheduled_end)).toBe(result.secondEnd);
});

test("TDD-US3-EC010 / TDD-US3-OPT046: an automatic cached execution is never reissued as an explicit owner Resume command", () => {
	expect(observe().automaticDelivery).toEqual({ permissionPending: true, ordinaryLeaseIssued: false });
});

test.each(["different_media", "different_source_revision", "one_millisecond_gap", "uncertain_root", "revoked_root", "draining_root"])("TDD-US3-OPT046: %s cannot join an occupied physical capture and rollback preserves authority", (vector) => {
	expect(observe().negativeJoins[vector]).toEqual({ accepted: 0, state: "authorized", root: null, unchanged: true });
});
test("TDD-US3-FR013 / TDD-US3-OPT046: draining shared capture retains occupancy until all logical closure receipts reconcile", () => {
	const result = observe();
	expect(result.drainedStates).toEqual([{ state: "draining" }, { state: "draining" }]);
	expect(result.firstClosed).toHaveLength(1);
	expect(result.afterFirstClosed).toEqual({ actual_state: "running", desired_state: "running" });
	expect(result.secondClosed).toHaveLength(1);
	expect(result.afterAllClosed).toEqual({ actual_state: "stopped", desired_state: "stopped" });
	expect(result.finalStates.every((row: any) => row.state === "stopped" && row.stopped_at !== null)).toBe(true);
	expect(Date.parse(result.finalStates[0].scheduled_end)).toBe(result.firstEnd);
	expect(Date.parse(result.finalStates[1].scheduled_end)).toBe(result.secondEnd);
});

test.each([
	["foreign_owner_root", "23503"],
	["self_root", "23514"],
	["second_physical_root", "23505"],
])("TDD-US3-OPT046: persistence rejects %s without weakening physical ownership", (vector, code) => {
	expect(observe().continuityConstraints[vector]).toEqual({ code, unchanged: true });
});
