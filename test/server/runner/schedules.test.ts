/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US1-OPT085 U125: a read-only operator cannot mutate a Runner schedule through the shared service", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:schedule_permission_service");
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.unchanged).toBe(true);
	expect(result.successAudits).toBe(0);
});

let contractResult: any;
function contract() {
	return (contractResult ??= flowProbe("catalogue:workflow:runner_free_pro:schedule_contract"));
}

test("TDD-US3-FR011 U11: schedule source, targets and local timezone values survive an actual service reload", () => {
	const result = contract();
	expect(result.authenticated).toBe(true);
	expect(result.saved).toBe(true);
	expect(result.readAvailable).toBe(true);
	expect(result.initial.event).toMatchObject({ overlayId: result.expected.overlayId, sessionId: result.expected.sessionId, runnerId: result.expected.runnerId, destinationIds: [result.expected.targetId] });
	expect(result.initialView.events).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Retained schedule", timezone: "UTC", localStartDate: "2027-02-01", localEndDate: "2027-02-01", destinationIds: expect.arrayContaining([expect.any(String)]) })]));
});

test("TDD-US3-BND005: title0 is rejected at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.title0;
	expect(vector.result.success).toBe(false);
	expect(vector.result.code).toBe("INVALID_INPUT");
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-BND006: title1 is accepted at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.title1;
	expect(vector.result.success).toBe(true);
});

test("TDD-US3-BND007: title80 is accepted at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.title80;
	expect(vector.result.success).toBe(true);
});

test("TDD-US3-BND008: title81 is rejected at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.title81;
	expect(vector.result.success).toBe(false);
	expect(vector.result.code).toBe("INVALID_INPUT");
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-BND009: duration0 is rejected at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.duration0;
	expect(vector.result.success).toBe(false);
	expect(vector.result.code).toBe("INVALID_INPUT");
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-BND010: duration24 is accepted at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.duration24;
	expect(vector.result.success).toBe(true);
});

test("TDD-US3-BND011: duration24plus1 is accepted at the persisted service boundary", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.duration24plus1;
	expect(vector.result.success).toBe(true);
});

test("TDD-US3-DEC005 U187: rolling cache includes an already-active multi-week occurrence with its full end", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.vacation.success).toBe(true);
	const occurrences = result.activeCache.occurrences.filter((row: any) => row.eventId === result.vacation.event.id);
	expect(occurrences).toHaveLength(1);
	expect(occurrences[0]).toMatchObject({ startUtc: "2027-01-04T11:00:00.000Z", endUtc: "2027-01-13T12:00:00.000Z" });
});
test.each([
	[0, 23],
	[1, 25],
])("TDD-US3-DEC006 U188: Berlin all-day case %i expands to %i elapsed hours exactly once", (index, hours) => {
	const result = contract();
	expect(result.saved).toBe(true);
	const { saved, cache } = result.dst[index];
	expect(saved.success).toBe(true);
	const occurrences = cache.occurrences.filter((row: any) => row.eventId === saved.event.id);
	expect(occurrences).toHaveLength(1);
	expect((Date.parse(occurrences[0].endUtc) - Date.parse(occurrences[0].startUtc)) / 3600000).toBe(hours);
});

test("TDD-US3-DEC004 U186: moving a future one-time event preserves its occurrence key and suppression lookup across revisions", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.identity.moved.success).toBe(true);
	expect(result.identity.beforeId).toEqual(expect.any(String));
	expect(result.identity.afterId).toBe(result.identity.beforeId);
	expect(result.identity.beforeAnchor).toEqual(expect.any(String));
	expect(result.identity.afterAnchor).toBe(result.identity.beforeAnchor);
	expect(result.identity.suppression).toBe("manual_stop");
});

test("TDD-US3-OPT032: invalid negative preserves the complete persisted schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.negative;
	expect(vector.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-OPT033: invalid duration0 preserves the complete persisted schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.duration0;
	expect(vector.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-OPT034: invalid missingSource preserves the complete persisted schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.missingSource;
	expect(vector.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-OPT035: invalid missingTargets preserves the complete persisted schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.missingTargets;
	expect(vector.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-OPT036: invalid badZone preserves the complete persisted schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.vectors.badZone;
	expect(vector.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-EC006 U28: invalid dates, source, destinations and zone return specific validation without activation", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	for (const key of ["negative", "duration0", "missingSource", "missingTargets", "badZone"]) {
		expect(result.vectors[key].result).toMatchObject({ success: false, code: "INVALID_INPUT" });
		expect(result.vectors[key].unchanged).toBe(true);
	}
});

test("TDD-US3-OPT030 U70: a reloaded once event expands at its saved local instant with original targets", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const rows = result.beforeMove.occurrences.filter((row: any) => row.eventId === result.initial.event.id);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ startUtc: "2027-02-01T12:00:00.000Z", endUtc: "2027-02-01T13:00:00.000Z" });
});
test("TDD-US3-OPT031 U71: weekly reload preserves timezone and repeats at the intended local instant", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.weekly.success).toBe(true);
	const rows = result.weekCache.occurrences.filter((row: any) => row.eventId === result.weekly.event.id);
	expect(rows).toHaveLength(1);
	expect(rows[0].startUtc).toBe("2026-03-22T01:30:00.000Z");
});
test("TDD-US3-OPT090 U130: a timezone-aware midnight interval retains both actual UTC bounds", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.midnight.success).toBe(true);
	expect(result.midnightCache.occurrences).toEqual(expect.arrayContaining([expect.objectContaining({ eventId: result.midnight.event.id, startUtc: "2027-01-04T22:30:00.000Z", endUtc: "2027-01-04T23:30:00.000Z" })]));
});
test("TDD-US3-OPT091 U131: future timezone edits preserve occurrence identity without duplicating the current interval", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.timezoneChange.success).toBe(true);
	const before = result.weekCache.occurrences.filter((row: any) => row.eventId === result.weekly.event.id),
		after = result.newWeekCache.occurrences.filter((row: any) => row.eventId === result.weekly.event.id);
	expect(before).toHaveLength(1);
	expect(after).toHaveLength(1);
	expect(after[0].occurrenceId).toBe(before[0].occurrenceId);
	expect(after[0].startUtc).toBe("2026-03-22T06:30:00.000Z");
});
test("TDD-US3-EC011 U33: a storage failure rolls back event mutation and preserves its optimistic revision", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.rollback).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.rollbackUnchanged).toBe(true);
	expect(result.stale).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.staleUnchanged).toBe(true);
});
test("TDD-US3-CON009 U145 U258 U259: actual persisted weekly expansion skips a gap and selects the first repeated instant", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.weekly.success).toBe(true);
	expect(result.spring.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ eventId: result.weekly.event.id, reason: "DST_GAP" })]));
	expect(result.fall.occurrences.filter((row: any) => row.eventId === result.weekly.event.id)).toEqual([expect.objectContaining({ startUtc: "2026-10-25T00:30:00.000Z", endUtc: "2026-10-25T02:30:00.000Z" })]);
});
test.each([
	[-1, false],
	[0, true],
	[7, true],
	[8, false],
])("TDD-US3-CON009 U217 U218 U219 U220: weekly endDayOffset %i accepted=%s", (offset, accepted) => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.offsets.find((row: any) => row.offset === offset);
	expect(vector.result.success).toBe(accepted);
	expect(vector.count).toBe(accepted ? 1 : 0);
	if (!accepted) expect(vector.result.code).toBe("INVALID_INPUT");
});
test("TDD-US3-OPT037 / TDD-US3-CON009 U260: a prior-day crossing interval prevents an overlapping adjacent-date save", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.overlap).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.stringMatching(/overlaps another event/i) });
	expect(result.overlapUnchanged).toBe(true);
});
test("TDD-US3-CON009: concurrent same-Runner overlapping saves serialize under owner authority", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.raced.filter((row: any) => row.success)).toHaveLength(1);
	expect(result.raced.filter((row: any) => !row.success)).toEqual([expect.objectContaining({ code: "INVALID_INPUT" })]);
});

test("TDD-US5-CON015: dashboard schedule reads use fresh Runner policy even before the raw Pro plan is reconciled", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.initialView.policy).toMatchObject({ runnerPro: true, scheduling: true });
	expect(result.retainedPlan).toBe("pro");
	expect(result.expiredView.policy).toMatchObject({ runnerPro: false, scheduling: false, attributionRequired: true });
	expect(result.expiredView.events.length).toBeGreaterThan(0);
});

test("TDD-US5-CON015: the legacy scalar configuration action also rejects paid Scheduled edits at a known billing end", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.retainedPlan).toBe("pro");
	expect(result.legacyPaidDenied).toMatchObject({ success: false, code: "ENTITLEMENT_REQUIRED" });
});

test.each(["badDate", "badTime", "malformedDate", "missingDate"])("TDD-US3-EC006: %s returns a normal validation result through both service and authenticated action", (key) => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.malformed[key];
	expect(vector.direct).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.action).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(vector.unchanged).toBe(true);
});

test("TDD-US3-FR011: a seven-day versioned schedule snapshot signs the authorized owner, device, source revision and target selection", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.signedObserved.present).toBe(true);
	expect(result.signedObserved.verified).toBe(true);
	const claims = result.signedObserved.claims;
	expect(claims).toMatchObject({ issuer: "clipify.us", kind: "schedule", version: 1, ownerId: "fixture-creator", runnerId: result.expected.runnerId });
	expect(claims.snapshotRevision).toMatch(/^[a-f0-9]{64}$/);
	expect(claims.expiresAt - claims.issuedAt).toBe(604800000);
	expect(claims.occurrences).toEqual(expect.arrayContaining([expect.objectContaining({ eventId: result.initial.event.id, sessionId: result.expected.sessionId, overlayId: result.expected.overlayId, sourceRevision: 1, destinationIds: [result.expected.targetId] })]));
	expect(result.unsigned.bundle).toBeNull();
	expect(result.missingDevice).toMatchObject({ success: false, code: "RESOURCE_UNAVAILABLE" });
	expect(result.expiredSigned.present).toBe(true);
	expect(result.expiredSigned.verified).toBe(true);
	expect(result.expiredSigned.claims.occurrences).toEqual([]);
	expect(result.expiredView.events.length).toBeGreaterThan(0);
});

test("TDD-US3-DEC004: persisted weekly member edits preserve other occurrence keys and the original recurrence epoch", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const identity = result.weeklyIdentity;
	expect(identity.memberRemoved.success).toBe(true);
	expect(identity.memberAdvanced.success).toBe(true);
	expect(identity.before).toEqual(expect.any(String));
	expect(identity.after).toBe(identity.before);
	expect(identity.futureBefore.length).toBeGreaterThan(0);
	expect(identity.futureAfter).toEqual(identity.futureBefore);
});

test("TDD-US2-CON005: a destination used only by a schedule cannot be deleted or silently removed from that schedule", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	const reference = result.scheduleReference;
	expect(reference.attempted).toMatchObject({ success: false, code: "RESOURCE_IN_USE" });
	expect(reference.unchanged).toBe(true);
	expect(reference.targetRetained).toBe(true);
	expect(reference.attempted.references.schedules).toContain(reference.eventId);
});

test.each([...["missingRevision", "missingEnd", "emptyWeekdays", "selfOverlap", "unknownRunner", "unknownSession", "unknownSource", "unknownTarget", "primitive", "invalidOwner"].map((key) => [key, "INVALID_INPUT"]), ["missingEvent", "RESOURCE_UNAVAILABLE"], ["foreignOwner", "ACCESS_DENIED"]])("TDD-US3-EC006: %s returns %s and preserves all event rows, selected targets and success audits", (key, code) => {
	const result = contract();
	expect(result.saved).toBe(true);
	const vector = result.boundaryCases[key];
	expect(vector.result).toMatchObject({ success: false, code });
	expect(vector.unchanged).toBe(true);
});
test("TDD-US3-CON009: an owned empty Runner has an empty calendar, and invalid read inputs cannot choose server policy time", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.emptyList).toMatchObject({ success: true, events: [] });
	expect(result.emptySnapshot).toMatchObject({ success: true, occurrences: [], skipped: [] });
	expect(result.badRead).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.untrustedClock).toMatchObject({ success: false, code: "INVALID_INPUT" });
});
test("TDD-US3-CON009: a disabled overlapping draft is retained but cannot produce signed start instructions", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.disabled.success).toBe(true);
	expect(result.disabled.event.enabled).toBe(false);
	expect(result.disabledCache.occurrences.some((row: any) => row.eventId === result.disabled.event.id)).toBe(false);
});
test("TDD-US3-FR011: schedule snapshot validity is clipped to the known paid end, and expired calendar edits return a normal restriction", () => {
	const result = contract();
	expect(result.saved).toBe(true);
	expect(result.boundedSigned.verified).toBe(true);
	expect(result.boundedSigned.claims.expiresAt).toBe(Date.parse(result.knownEnd));
	expect(result.boundedSigned.claims.expiresAt - result.boundedSigned.claims.issuedAt).toBeLessThanOrEqual(604800000);
	expect(result.expiredWrite).toMatchObject({ success: false, code: "FEATURE_RESTRICTED" });
	expect(result.expiredWriteUnchanged).toBe(true);
});

test("TDD-US3-DEC007 U189: active event move, resize and configuration edits are rejected atomically through service and action", () => {
	const result = contract();
	expect(Object.keys(result.activeEdits)).toHaveLength(6);
	for (const observation of Object.values(result.activeEdits) as { result: { success: boolean; code: string }; unchanged: boolean }[]) {
		expect(observation.result).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
		expect(observation.unchanged).toBe(true);
	}
});

test("TDD-US3-DEC007: an ended occurrence stays locked during captured output drain and unlocks only after terminal closure", () => {
	const result = contract();
	expect(result.drainingEdit).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
	expect(result.drainingUnchanged).toBe(true);
	expect(result.afterClosureEdit).toMatchObject({ success: true, event: { title: "Editable after closure" } });
});

test("TDD-US3-DEC007: deleting an active occurrence cannot remove the event or its selected targets", () => {
	const result = contract();
	expect(result.activeDelete).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
	expect(result.activeDeleteUnchanged).toBe(true);
});
test("TDD-US3-OPT028 U68: deleting an owned future schedule atomically removes its joins and records one successful deletion", () => {
	const result = contract();
	expect(result.deletedEvent).toMatchObject({ success: true });
	expect(result.deletedRows).toBe(0);
	expect(result.deletedJoins).toBe(0);
	expect(result.deletionAudits).toBe(1);
});
test("TDD-US3-OPT029 U69: a stale schedule deletion through the authenticated action preserves all rows and success audit state", () => {
	const result = contract();
	expect(result.staleDelete).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.staleDeleteUnchanged).toBe(true);
});

test("TDD-US3-OPT023 U63: a keyboard form action moves the same event with one revision and retained recurrence/source/targets", () => {
	const result = contract(),
		before = result.keyboardMoveBefore;
	expect(result.keyboardMove).toMatchObject({ success: true, event: { id: before.id, configurationRevision: before.configurationRevision + 1, recurrenceAnchor: before.recurrenceAnchor, overlayId: before.overlayId, timezone: before.timezone, localStartTime: "13:00", localEndTime: "14:00" } });
	expect(result.keyboardMoveJoins).toEqual([{ destination_id: result.expected.targetId }]);
});

test("TDD-US3-OPT025 U65: keyboard resize retains start/source/anchor and invalid end cannot partially save", () => {
	const result = contract(),
		before = result.keyboardMove.event;
	expect(result.keyboardResize).toMatchObject({ success: true, event: { id: before.id, configurationRevision: before.configurationRevision + 1, recurrenceAnchor: before.recurrenceAnchor, overlayId: before.overlayId, localStartTime: before.localStartTime, localEndTime: "15:00" } });
	expect(result.keyboardInvalidResize).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.keyboardInvalidResizeUnchanged).toBe(true);
});

test("TDD-US3-OPT020 U60: authoring a pointer schedule cannot itself request output or allocate an admission", () => {
	expect(contract().authoringState).toEqual({ desiredState: "stopped", admissions: 0 });
});
test("TDD-US3-OPT021 U61: an authenticated keyboard form creation retains the selected source and target join", () => {
	const result = contract();
	expect(result.formCreate).toMatchObject({ success: true, event: { title: "Keyboard authored", overlayId: result.expected.overlayId, sessionId: result.expected.sessionId, destinationIds: [result.expected.targetId] } });
	expect(result.formCreateJoins).toEqual([{ destination_id: result.expected.targetId }]);
});
test("TDD-US3-OPT026 U66: editing title metadata cannot replace dates, source, recurrence identity or target membership", () => {
	const result = contract(),
		before = result.metadataBefore;
	expect(result.pointerMetadataEdit).toMatchObject({ success: true, event: { id: before.id, title: "Renamed pointer", configurationRevision: 2, recurrenceAnchor: before.recurrenceAnchor, localStartDate: before.localStartDate, localEndDate: before.localEndDate, localStartTime: before.localStartTime, localEndTime: before.localEndTime, overlayId: before.overlayId, destinationIds: before.destinationIds } });
});
test("TDD-US3-OPT027 U67: a keyboard metadata action updates timezone and title with one revision while retaining source/targets", () => {
	const result = contract(),
		before = result.metadataBefore;
	expect(result.keyboardMetadataEdit).toMatchObject({ success: true, event: { id: before.id, title: "Renamed keyboard", timezone: "America/New_York", configurationRevision: 3, recurrenceAnchor: before.recurrenceAnchor, overlayId: before.overlayId, destinationIds: before.destinationIds } });
	expect(result.metadataJoins).toEqual([{ destination_id: result.expected.targetId }]);
});

// Existing half-open activation rule: trusted-clock characterization, not a fabricated Red.
test("TDD-US3-DEC007 U212: an otherwise valid edit is allowed at activation minus one millisecond", () => {
	expect(contract().beforeActivationEdit).toMatchObject({ success: true, event: { title: "Allowed before activation" } });
});
test("TDD-US3-DEC007 U213: an edit exactly at activation preserves event targets and success audit state", () => {
	const result = contract();
	expect(result.exactActivationEdit).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
	expect(result.exactActivationEditUnchanged).toBe(true);
});
test("TDD-US3-DEC007 U213: deletion exactly at activation preserves the original event and targets", () => {
	const result = contract();
	expect(result.exactActivationDelete).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
	expect(result.exactActivationDeleteUnchanged).toBe(true);
});

test("TDD-US3-DEC008 U190/U210: explicit resume one millisecond before original end retains Scheduled mode, occurrence and end", () => {
	const result = contract();
	expect(result.resumedBeforeEnd).toMatchObject({ accepted: true, requestedState: "running", controlMode: "scheduled" });
	expect(result.beforeEndState.session).toMatchObject({ desired_state: "running", actual_state: "stopped", control_mode: "scheduled", configuration_revision: 11 });
	const admitted = result.beforeEndState.admissions.find((row: { id: string }) => row.id !== result.stoppedAdmission);
	expect(admitted).toMatchObject({ occurrence_id: result.resumeOccurrenceId, scheduled_end: result.resumeEnd, state: "reserved" });
});
test("TDD-US3-DEC008 U211: resume at the original end cannot allocate or reopen an execution", () => {
	const result = contract();
	expect(result.resumedAtEnd).toMatchObject({ error: { code: "SCHEDULE_WINDOW_ENDED" } });
	expect(result.atEndUnchanged).toBe(true);
});
test("TDD-US3-DEC008 U210: a pending output drain prevents resume even before original end", () => {
	const result = contract();
	expect(result.resumedBeforeClosure).toMatchObject({ error: { code: "RUNNER_RECOVERY_REQUIRED" } });
	expect(result.resumedBeforeClosure.legacyThrown ?? false).toBe(false);
	expect(result.beforeClosureUnchanged).toBe(true);
});

test.each(["active", "reserved"])("TDD-US3-DEC008 U190: Stop durably suppresses the %s captured occurrence without changing Scheduled mode or its end", (initialState) => {
	const result = contract();
	const stopped = result.stopObservations.find((row: { initialState: string }) => row.initialState === initialState);
	expect(stopped.result).toMatchObject({ accepted: true, requestedState: "stopped", controlMode: "scheduled" });
	expect(stopped.session).toMatchObject({ desired_state: "stopped", control_mode: "scheduled", configuration_revision: 11 });
	expect(stopped.admission).toMatchObject({ state: initialState === "active" ? "draining" : "failed_before_output", occurrence_id: result.resumeOccurrenceId, scheduled_end: result.resumeEnd, benefits_at_start: { scheduleSuppressed: true } });
	expect(stopped.edit).toMatchObject({ success: false, code: "ACTIVE_OCCURRENCE_LOCKED" });
});

test("TDD-US3-DEC008 U190: signed occurrence metadata retains Stop suppression until a newer explicit Resume", () => {
	const result = contract();
	expect(result.resumedCache.verified).toBe(true);
	const resumed = result.resumedCache.claims.occurrences.find((row: { occurrenceId: string }) => row.occurrenceId === result.resumeOccurrenceId);
	expect(resumed).toMatchObject({ suppressed: false, executionRevision: 11, endUtc: result.resumeEnd });
	for (const observation of result.stopObservations) {
		expect(observation.stoppedCache.verified).toBe(true);
		const stopped = observation.stoppedCache.claims.occurrences.find((row: { occurrenceId: string }) => row.occurrenceId === result.resumeOccurrenceId);
		expect(stopped).toMatchObject({ suppressed: true, executionRevision: 9, endUtc: result.resumeEnd });
	}
});

test("TDD-US3-FR012: scheduled reservation captures event targets without overwriting manual defaults", () => {
	const result = contract().eventTargetCapture;
	expect(result.start).toMatchObject({ accepted: true, requestedState: "running" });
	expect(result.captures).toEqual([{ target_ids_snapshot: [result.expectedEventTarget] }]);
	expect(result.defaults).toEqual([{ destination_id: result.expectedDefaultTarget }]);
});

test("TDD-US3-FR012: a signed scheduled permit uses the captured event source rather than the manual default", () => {
	const result = contract().eventTargetCapture;
	expect(result.lease.verified).toBe(true);
	expect(result.lease.claims).toMatchObject({ sourceId: result.expectedEventSource, sourceRevision: result.expectedSourceRevision });
});

test("TDD-US3-FR012: authenticated heartbeat delivers the same private source that its scheduled permit authorizes", () => {
	const result = contract().eventTargetCapture;
	expect(result.heartbeatSource).toMatchObject({ status: 200, overlayId: result.expectedEventSource, sourceRevision: 7, correctPrivateSource: true });
	expect(result.heartbeatSource.signed.verified).toBe(true);
	expect(result.heartbeatSource.signed.claims.sourceId).toBe(result.heartbeatSource.overlayId);
});

test("TDD-US3-FR012 prerequisite: an accepted manual execution keeps its source identity when overlay styling is edited", () => {
	const result = contract().manualSourceCapture;
	expect(result.start.accepted).toBe(true);
	expect(result.before.verified).toBe(true);
	expect(result.after.verified).toBe(true);
	expect(result.after.claims).toMatchObject({ sourceId: result.expectedSource, sourceRevision: result.before.claims.sourceRevision, generation: result.before.claims.generation, admissionId: result.before.claims.admissionId });
});

test("TDD-US3-FR012 issuance: an authenticated capable device receives bounded future authorization without starting its session", () => {
	const result = contract().offlineAuthorization;
	expect(result.status).toBe(200);
	expect(result.cache).not.toBeNull();
	expect(result.cache.entries).toEqual(expect.arrayContaining([expect.objectContaining({ job: expect.objectContaining({ id: result.sessionId, overlayId: result.expectedSource, cacheAuthorization: true, occurrenceId: expect.stringContaining(result.eventId) }) })]));
	expect(result.session).toEqual({ desired_state: "stopped", actual_state: "stopped" });
	expect(result.admissions).toEqual(expect.arrayContaining([expect.objectContaining({ state: "authorized", target_ids_snapshot: [result.expectedTarget] })]));
});

test("TDD-US3-DEC007 prerequisite: issuing a future authorization does not lock its event before activation", () => {
	expect(contract().offlineAuthorization.futureEdit).toMatchObject({ success: true, event: { title: "Edited before activation" } });
});

test("TDD-US3-FR012 prerequisite: a future authorization cannot be reused as an unrelated manual reservation", () => {
	const result = contract().offlineAuthorization.independentManual;
	expect(result.result).toMatchObject({ accepted: true, requestedState: "running" });
	expect(result.admissions).toEqual(expect.arrayContaining([expect.objectContaining({ state: "reserved", occurrence_id: null, target_ids_snapshot: [result.expectedDefaultTarget] }), expect.objectContaining({ state: "authorized", occurrence_id: expect.any(String) })]));
});

test("TDD-US3-FR012 prerequisite: stopping current output does not drain its unrelated future cached authorizations", () => {
	const result = contract().offlineAuthorization.manualStop;
	expect(result.result).toMatchObject({ accepted: true, requestedState: "stopped" });
	expect(result.future.length).toBeGreaterThan(0);
	expect(result.future.every((row: { state: string }) => row.state === "authorized")).toBe(true);
});

test.each(["wrong token", "wrong owner", "invalid nonce"])("TDD-US3-FR012 device cache baseline: %s cannot mint or change future authority", (name) => {
	expect(contract().offlineAuthorization.deviceDenials.find((row: { name: string }) => row.name === name)).toEqual({ name, denied: true, unchanged: true });
});
test("TDD-US3-FR012 device cache baseline: manifest and individual authorizations use verified separate purposes and bounded validity", () => {
	const result = contract().offlineAuthorization;
	expect(result.signedManifest.verified).toBe(true);
	expect(result.signedManifest.claims).toMatchObject({ kind: "schedule_cache", issuer: "clipify.us", version: 1 });
	expect(result.signedExecutions.length).toBeGreaterThan(0);
	for (const entry of result.signedExecutions) {
		expect(entry.verified).toBe(true);
		expect(entry.claims).toMatchObject({ kind: "scheduled_execution", policy: "pro_broadcast", cacheAuthorization: true });
		expect(entry.claims.expiresAt - entry.claims.issuedAt).toBeLessThanOrEqual(604800000);
		expect(entry.claims.scheduledStart).toBeLessThan(entry.claims.scheduledEnd);
	}
});

test("TDD-US3-FR012 reconciliation: closing unused future authority does not stop a newer manual execution", () => {
	const result = contract().offlineAuthorization.futureReceipt;
	expect(result.accepted).toEqual([expect.objectContaining({ admissionId: result.expectedAdmission, state: "stopped" })]);
	expect(result.session).toEqual({ desired_state: "running", actual_state: "running", configuration_revision: 41 });
});

test("TDD-US3-FR012 reconciliation: actual cached output is recognized only from the original start and retains Scheduled mode", () => {
	const result = contract().offlineAuthorization.activeReceipt;
	expect(result.before).toEqual([]);
	expect(result.atStart).toEqual([expect.objectContaining({ admissionId: result.admissionId, state: "active" })]);
	expect(result.session).toEqual({ desired_state: "running", actual_state: "running", control_mode: "scheduled" });
	expect(result.admission).toMatchObject({ state: "active", occurrence_id: expect.any(String) });
});

test("TDD-US3-FR012 refresh: an accepted cached occurrence retains its admission and private target capture", () => {
	const result = contract().offlineAuthorization.activeRefresh;
	expect(result.job).toMatchObject({ admissionId: result.oldAdmission, targetUrl: "rtmp://127.0.0.1:1950/event", end: result.expectedEnd });
});

test("TDD-US3-FR012 revocation: cached future authority retains a terminal tombstone without becoming concurrent physical output", () => {
	const result = contract().offlineAuthorization.revocation;
	expect(result.success).toBe(true);
	expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ state: "authorized", revoked: true, terminalCredential: true }), expect.objectContaining({ state: "draining", revoked: true, terminalCredential: true })]));
	expect(result.rows.filter((row: { state: string }) => row.state === "draining")).toHaveLength(1);
});

test("TDD-US3-FR012 recovery: bounded expired cached authority releases without stopping separate accepted output", () => {
	expect(contract().offlineAuthorization.recovery).toEqual({ state: "stopped", reason: "lease_recovered", recovered: true, desired: "running", actual: "running" });
});

test("TDD-US3-CON008: Scheduled Stop suppresses its current occurrence while unrelated future cached windows remain enabled", () => {
	const result = contract().offlineAuthorization.scheduledStop;
	expect(result.accepted).toBe(true);
	expect(result.current).toBe(true);
	expect(result.future.length).toBeGreaterThan(0);
	expect(result.future.every((row: { suppressed: boolean }) => !row.suppressed)).toBe(true);
});

test("TDD-US3-FR012 admission: unacknowledged in-window cached authority blocks a competing same-session Manual start", () => {
	expect(contract().offlineAuthorization.unknownOutput).toMatchObject({ error: { code: "RUNNER_RECOVERY_REQUIRED" } });
});

test.each(["manual selection", "paused source", "missing captured source", "unreadable captured targets", "suppressed occurrence"])("TDD-US3-FR012 issuance baseline: %s cannot create future authority or replace accepted private capture", (name) => {
	expect(contract().offlineAuthorization.inputDenials.find((row: { name: string }) => row.name === name)).toEqual({ name, entries: 0, unchanged: true });
});

test.each([
	["deleteOwner", "INVALID_INPUT"],
	["deleteShape", "INVALID_INPUT"],
	["deleteMissing", "RESOURCE_UNAVAILABLE"],
	["resumeShape", "INVALID_INPUT"],
])("TDD-US3-CON008 service boundary baseline: %s returns a normal domain result", (name, code) => {
	expect(contract().offlineAuthorization.invalidActions[name]).toMatchObject({ success: false, code });
});

test("TDD-US3-FR013: actual persisted cached finishing remains occupied, is idempotent and closes only on terminal proof", () => {
	const result = contract().offlineAuthorization.finishing;
	expect(result.before).toEqual([]);
	expect(result.atEnd).toEqual([expect.objectContaining({ admissionId: result.admissionId, state: "draining" })]);
	expect(result.pending).toMatchObject({ state: "draining", stopped_at: null });
	expect(result.visible).toMatchObject({ desired_state: "stopped", actual_state: "running" });
	expect(result.repeated).toEqual(result.atEnd);
	expect(result.repeatedSession).toEqual(result.visible);
	expect(result.terminal).toEqual([expect.objectContaining({ admissionId: result.admissionId, state: "stopped" })]);
	expect(result.closed).toMatchObject({ state: "stopped", terminal_reason: "playback_timeout" });
	expect(result.closed.stopped_at).not.toBeNull();
	expect(result.finalSession).toMatchObject({ desired_state: "stopped", actual_state: "stopped", last_error: "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit." });
});

test("TDD-US3-EC009: authenticated session reads expose finite timeout state without native diagnostics", () => {
	expect(contract().offlineAuthorization.playbackViews).toEqual({ timeout: { hasError: true, playbackTimedOut: true }, healthy: { hasError: false, playbackTimedOut: false }, safe: true });
});

test("TDD-US3-EC010: an explicit owner Resume delivers signed ordinary execution identity with immutable occurrence bounds", () => {
	const result = contract();
	expect(result.resumedBeforeEnd).toMatchObject({ accepted: true, controlMode: "scheduled" });
	expect(result.resumedExecution).not.toBeNull();
	const resumed = result.resumedExecution;
	expect(resumed.signed.verified).toBe(true);
	expect(resumed.job).toMatchObject({ occurrenceId: result.resumeOccurrenceId, scheduledStart: resumed.expectedStart, scheduledEnd: resumed.expectedEnd, configurationRevision: 11 });
	expect(resumed.signed.claims).toMatchObject({ kind: "execution", policy: "pro_broadcast", occurrenceId: result.resumeOccurrenceId, scheduledStart: resumed.expectedStart, scheduledEnd: resumed.expectedEnd, configurationRevision: 11 });
});
