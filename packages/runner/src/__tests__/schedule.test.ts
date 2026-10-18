import { resolveCalendarSchedule, scheduleOccurrenceKey, type CalendarSchedule } from "../schedule";
const event: CalendarSchedule = { id: "dst-event", configurationRevision: 1, timezone: "Europe/Berlin", recurrence: "weekly", localStartDate: "2026-03-22", localEndDate: null, localStartTime: "02:30", localEndTime: "03:30", weekdays: [7], endDayOffset: 0, recurrenceAnchor: "2026-03-22" };
test("TDD-US3-EC007 U29: a boundary in the spring gap is skipped while the following local week is preserved", () => {
	const original = structuredClone(event);
	const result = resolveCalendarSchedule(event, { start: "2026-03-28T00:00:00Z", end: "2026-04-06T00:00:00Z" });
	expect(result.skipped).toEqual([expect.objectContaining({ eventId: event.id, reason: "DST_GAP", message: expect.stringMatching(/does not exist|clock change/i) })]);
	expect(result.occurrences).toEqual([expect.objectContaining({ startUtc: "2026-04-05T00:30:00.000Z", endUtc: "2026-04-05T01:30:00.000Z" })]);
	expect(event).toEqual(original);
});
test("TDD-US3-EC008 U30: the repeated fall boundary resolves only to its first instant", () => {
	const result = resolveCalendarSchedule({ ...event, localStartDate: "2026-10-25", recurrenceAnchor: "2026-10-25" }, { start: "2026-10-24T00:00:00Z", end: "2026-10-26T00:00:00Z" });
	expect(result.skipped).toEqual([]);
	expect(result.occurrences).toHaveLength(1);
	expect(result.occurrences[0]).toMatchObject({ startUtc: "2026-10-25T00:30:00.000Z", endUtc: "2026-10-25T02:30:00.000Z" });
	expect(result.occurrences[0].occurrenceId).toEqual(expect.any(String));
});

test("TDD-US3-DEC004: removing another weekday or advancing the series start cannot reassign an existing weekly occurrence", () => {
	const original = {
		...event,
		timezone: "UTC",
		localStartDate: "2026-03-23",
		recurrenceAnchor: "2026-03-23",
		localStartTime: "16:00",
		localEndTime: "17:00",
		weekdays: [1, 3],
		weekdayAnchors: [
			{ weekday: 1, anchor: "monday-slot" },
			{ weekday: 3, anchor: "wednesday-slot" },
		],
	};
	const first = resolveCalendarSchedule(original, { start: "2026-03-23T00:00:00Z", end: "2026-03-30T00:00:00Z" });
	const before = first.occurrences.find((row) => row.startUtc === "2026-03-25T16:00:00.000Z")!;
	const withoutMonday = { ...original, weekdays: [3], weekdayAnchors: [{ weekday: 3, anchor: "wednesday-slot" }] };
	const next = resolveCalendarSchedule(withoutMonday, { start: "2026-03-23T00:00:00Z", end: "2026-03-30T00:00:00Z" });
	expect(before.occurrenceId).toEqual(expect.any(String));
	const stopped = new Map([[scheduleOccurrenceKey({ eventId: original.id, recurrenceAnchor: before.recurrenceAnchor, configurationRevision: original.configurationRevision }), "manual_stop"]]);
	expect(stopped.get(next.occurrences[0].occurrenceId)).toBe("manual_stop");
	expect(next.occurrences[0].occurrenceId).toBe(before.occurrenceId);
	const later = { start: "2026-03-30T00:00:00Z", end: "2026-04-06T00:00:00Z" };
	const future = resolveCalendarSchedule(withoutMonday, later),
		advanced = resolveCalendarSchedule({ ...withoutMonday, localStartDate: "2026-03-30" }, later);
	expect(advanced.occurrences.map((row) => row.occurrenceId)).toEqual(future.occurrences.map((row) => row.occurrenceId));
});

const once: CalendarSchedule = { ...event, recurrence: "once", timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-13", localStartTime: "12:00", localEndTime: "12:00", recurrenceAnchor: "2027-01-04", weekdays: [] };
test("TDD-US3-DEC005: an already-active multi-week once window retains its full end and immutable key", () => {
	const result = resolveCalendarSchedule(once, { start: "2027-01-10T00:00:00Z", end: "2027-01-17T00:00:00Z" });
	expect(result.skipped).toEqual([]);
	expect(result.occurrences).toHaveLength(1);
	expect(result.occurrences[0]).toMatchObject({ startUtc: "2027-01-04T12:00:00.000Z", endUtc: "2027-01-13T12:00:00.000Z", recurrenceAnchor: once.recurrenceAnchor });
});
test.each([
	["2026-03-29", "2026-03-30", 23],
	["2026-10-25", "2026-10-26", 25],
])("TDD-US3-DEC006: local all-day %s to %s contains %i real hours", (start, end, hours) => {
	const result = resolveCalendarSchedule({ ...once, timezone: "Europe/Berlin", localStartDate: String(start), localEndDate: String(end), localStartTime: "00:00", localEndTime: "00:00" }, { start: String(start) + "T00:00:00Z", end: String(end) + "T12:00:00Z" });
	expect(result.skipped).toEqual([]);
	expect(result.occurrences).toHaveLength(1);
	expect((Date.parse(result.occurrences[0].endUtc) - Date.parse(result.occurrences[0].startUtc)) / 3600000).toBe(hours);
});
test("TDD-US3-EC007: a gap at the end boundary also skips a once window with a visible reason", () => {
	const result = resolveCalendarSchedule({ ...once, timezone: "Europe/Berlin", localStartDate: "2026-03-29", localEndDate: "2026-03-29", localStartTime: "01:30", localEndTime: "02:30" }, { start: "2026-03-28T00:00:00Z", end: "2026-03-30T00:00:00Z" });
	expect(result.occurrences).toEqual([]);
	expect(result.skipped).toEqual([expect.objectContaining({ reason: "DST_GAP", message: expect.stringMatching(/does not exist/) })]);
});
test.each(["12:00", "11:59"])("TDD-US3-EC006: an invalid once end %s emits no executable interval", (end) => {
	const result = resolveCalendarSchedule({ ...once, localEndDate: once.localStartDate, localEndTime: end }, { start: "2027-01-04T00:00:00Z", end: "2027-01-05T00:00:00Z" });
	expect(result.occurrences).toEqual([]);
	expect(result.skipped).toEqual([expect.objectContaining({ reason: "INVALID_WINDOW" })]);
});
test.each([
	{ start: "invalid", end: "2027-01-17T00:00:00Z" },
	{ start: "2027-01-10T00:00:00Z", end: "invalid" },
	{ start: "2027-01-10T00:00:00Z", end: "2027-01-10T00:00:00Z" },
	{ start: "2027-01-17T00:00:00Z", end: "2027-01-10T00:00:00Z" },
])("TDD-US3-CON009: invalid horizon %j cannot invent occurrences", (horizon) => {
	expect(resolveCalendarSchedule(once, horizon)).toEqual({ occurrences: [], skipped: [] });
});
test.each([{ localStartDate: null }, { localEndDate: null }])("TDD-US3-CON009: incomplete once date %j cannot invent an interval", (patch) => {
	expect(resolveCalendarSchedule({ ...once, ...patch }, { start: "2027-01-10T00:00:00Z", end: "2027-01-17T00:00:00Z" })).toEqual({ occurrences: [], skipped: [] });
});
test.each([
	{ start: "2027-01-03T00:00:00Z", end: "2027-01-04T12:00:00Z" },
	{ start: "2027-01-13T12:00:00Z", end: "2027-01-14T00:00:00Z" },
])("TDD-US3-CON009: half-open horizon %j does not include a merely touching once event", (horizon) => {
	expect(resolveCalendarSchedule(once, horizon)).toEqual({ occurrences: [], skipped: [] });
});
test("TDD-US3-CON009: an absent weekly first date uses its immutable calendar anchor", () => {
	const result = resolveCalendarSchedule({ ...event, localStartDate: null }, { start: "2026-03-21T00:00:00Z", end: "2026-03-23T00:00:00Z" });
	expect(result.occurrences).toHaveLength(1);
	expect(result.occurrences[0].startUtc).toBe("2026-03-22T01:30:00.000Z");
});
test("TDD-US3-DEC004: opaque anchor compatibility and an empty optional member map remain stable across revisions", () => {
	const input = { ...event, recurrenceAnchor: "opaque-original-anchor", weekdayAnchors: [] };
	const horizon = { start: "2026-03-21T00:00:00Z", end: "2026-03-23T00:00:00Z" };
	const before = resolveCalendarSchedule(input, horizon),
		after = resolveCalendarSchedule({ ...input, configurationRevision: 500 }, horizon);
	expect(before.occurrences).toHaveLength(1);
	expect(after.occurrences[0].occurrenceId).toBe(before.occurrences[0].occurrenceId);
	expect(after.occurrences[0].recurrenceAnchor).toContain("opaque-original-anchor");
});

// Cached schedule authorizations have a distinct purpose and explicit caller opt-in.
// They cannot substitute for a normal manual execution permit.
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { verifyExecutionBundle, ProExecutionPermit } from "../protocol";
function cachedAuthorization() {
	const keys = generateKeyPairSync("ed25519");
	const issuedAt = 1000000;
	const identity = { ownerId: "creator", runnerId: randomUUID(), sessionId: randomUUID(), generation: randomUUID(), admissionId: randomUUID(), leaseId: randomUUID(), requestId: randomUUID(), sourceId: randomUUID(), targetHash: "a".repeat(64), configurationRevision: 1, sourceRevision: 1, occurrenceId: '["event","immutable-anchor"]', scheduledStart: issuedAt + 3600000, scheduledEnd: issuedAt + 7200000, cacheAuthorization: true as const, executionPayloadHash: "b".repeat(64) };
	const claims = { ...identity, issuer: "clipify.us", kind: "scheduled_execution", policy: "pro_broadcast", issuedAt, expiresAt: issuedAt + 604800000 };
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const bundle = { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString("base64url") };
	const signed = (value: object) => {
		const serialized = Buffer.from(JSON.stringify(value)).toString("base64url");
		return { keyId: "fixture", payload: serialized, signature: sign(null, Buffer.from(serialized), keys.privateKey).toString("base64url") };
	};
	return { identity, claims, bundle, signed, keys: { fixture: keys.publicKey.export({ type: "spki", format: "pem" }).toString() } };
}
test("TDD-US3-FR012: an explicitly bound cached Pro authorization can be verified before its future window", () => {
	const fixture = cachedAuthorization();
	expect(verifyExecutionBundle(fixture.bundle, fixture.keys, fixture.identity, fixture.claims.issuedAt)).toEqual(fixture.claims);
	const { cacheAuthorization, ...manual } = fixture.identity;
	expect(cacheAuthorization).toBe(true);
	expect(verifyExecutionBundle(fixture.bundle, fixture.keys, manual, fixture.claims.issuedAt)).toBeNull();
});

test.each([
	["wrong owner", { ownerId: "another-creator" }],
	["wrong device", { runnerId: "99999999-9999-4999-8999-999999999999" }],
	["wrong occurrence", { occurrenceId: "different" }],
	["no occurrence", { occurrenceId: undefined }],
	["not cached", { cacheAuthorization: false }],
	["manual purpose", { kind: "execution" }],
	["free policy", { policy: "free_lease" }],
	["changed private payload", { executionPayloadHash: "c".repeat(64) }],
	["malformed payload digest", { executionPayloadHash: "b" }],
	["missing start", { scheduledStart: undefined }],
	["changed start", { scheduledStart: 4600001 }],
	["negative start", { scheduledStart: -1 }],
	["no original end", { scheduledEnd: null }],
	["empty window", { scheduledStart: 8200000 }],
	["beyond seven days", { expiresAt: 605800001 }],
] as const)("TDD-US3-FR012 cache validation baseline: %s cannot authorize a scheduled start", (_reason, patch) => {
	const fixture = cachedAuthorization();
	expect(verifyExecutionBundle(fixture.signed({ ...fixture.claims, ...patch }), fixture.keys, fixture.identity, fixture.claims.issuedAt)).toBeNull();
});
test("TDD-US3-FR012 cache validation baseline: unsigned or corrupted cached bytes never verify", () => {
	const fixture = cachedAuthorization();
	expect(verifyExecutionBundle({ ...fixture.bundle, signature: undefined }, fixture.keys, fixture.identity, fixture.claims.issuedAt)).toBeNull();
	const payload = Buffer.from(JSON.stringify({ ...fixture.claims, ownerId: "tampered" })).toString("base64url");
	expect(verifyExecutionBundle({ ...fixture.bundle, payload }, fixture.keys, fixture.identity, fixture.claims.issuedAt)).toBeNull();
	expect(verifyExecutionBundle(fixture.bundle, fixture.keys, fixture.identity, fixture.claims.expiresAt)).toBeNull();
});

test("TDD-US3-FR012: a verified cached authorization opens no output before its original start and drains at its original end", () => {
	const fixture = cachedAuthorization();
	const context = { requestId: fixture.identity.requestId, sentAt: 1000 };
	let elapsed = 1001;
	const permit = new ProExecutionPermit(fixture.identity, fixture.keys, () => elapsed);
	expect(permit.beginRenewal(context)).toBe(context.requestId);
	expect(permit.accept(fixture.bundle)).toBe(false);
	expect(permit.state).toBe("renewal_required");
	elapsed = 1000 + fixture.claims.scheduledStart - fixture.claims.issuedAt;
	expect(permit.beginRenewal(context)).toBe(context.requestId);
	expect(permit.accept(fixture.bundle)).toBe(true);
	expect(permit.state).toBe("active");
	elapsed = 1000 + fixture.claims.scheduledEnd - fixture.claims.issuedAt;
	expect(permit.state).toBe("draining");
	expect(permit.beginRenewal(context)).toBeNull();
});

test("TDD-US3-FR012: same-boot restored cache anchors can predate the new process clock without extending the original end", () => {
	const fixture = cachedAuthorization();
	let elapsed = 0;
	const restored = new ProExecutionPermit(fixture.identity, fixture.keys, () => elapsed);
	const context = { requestId: fixture.identity.requestId, sentAt: -3600000 };
	expect(restored.beginRenewal(context)).toBe(context.requestId);
	expect(restored.accept(fixture.bundle)).toBe(true);
	expect(restored.state).toBe("active");
	elapsed = 3600000;
	expect(restored.state).toBe("draining");
	const { cacheAuthorization, ...ordinary } = fixture.identity;
	expect(cacheAuthorization).toBe(true);
	expect(new ProExecutionPermit(ordinary, fixture.keys, () => 0).beginRenewal(context)).toBeNull();
});

test("TDD-US3-SC003 U38: cached permission preserves its original end throughout start-window evaluation", () => {
	const fixture = cachedAuthorization();
	const context = { requestId: fixture.identity.requestId, sentAt: 1000 };
	let elapsed = context.sentAt + fixture.claims.scheduledStart - fixture.claims.issuedAt;
	const permit = new ProExecutionPermit(fixture.identity, fixture.keys, () => elapsed);
	expect(permit.beginRenewal(context)).toBe(context.requestId);
	expect(permit.accept(fixture.bundle)).toBe(true);
	const originalDeadline = permit.deadlineMonotonic;
	elapsed += 30000;
	expect(permit.state).toBe("active");
	expect(permit.deadlineMonotonic).toBe(originalDeadline);
	elapsed = originalDeadline! - 1;
	expect(permit.state).toBe("active");
	elapsed++;
	expect(permit.state).toBe("draining");
	expect(permit.beginRenewal({ ...context, sentAt: elapsed })).toBeNull();
	expect(permit.deadlineMonotonic).toBe(originalDeadline);
});
