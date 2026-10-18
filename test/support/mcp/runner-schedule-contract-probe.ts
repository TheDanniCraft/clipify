import type { StreamState } from "@types";
import { randomUUID, verify } from "node:crypto";
import { ephemeralRunnerKeys } from "../runner/fixtures";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import * as schedules from "@/server/runner/schedules";
type Input = Parameters<typeof runRunnerFreeProProbe>[0] & { runnerId: string; authenticated: boolean; actions: typeof import("@/app/actions/runner") };

/** Actual authenticated service observer; a single disposable owner isolates the boundary vectors. */
export async function runRunnerScheduleContractProbe(input: Input) {
	const ownerId = "fixture-creator",
		overlayId = randomUUID(),
		sessionId = randomUUID(),
		targetId = randomUUID();
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'schedule-source-secret','Schedule source','active','Featured')", [overlayId, ownerId]);
	await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Schedule target','custom','rtmp://127.0.0.1:1949/live')", [targetId, ownerId, input.runnerId]);
	await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [sessionId, ownerId, input.runnerId, overlayId]);
	await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, targetId, ownerId]);
	const { privateKey, publicKey } = ephemeralRunnerKeys();
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	const principalResult = await getVerifiedSessionPrincipal();
	if (!principalResult) throw new Error("SCHEDULE_CONTRACT_AUTH_SETUP_FAILED");
	const principal = principalResult;
	const draft = { ownerId, runnerId: input.runnerId, sessionId, title: "Retained schedule", timezone: "UTC", recurrence: "once", localStartDate: "2027-02-01", localEndDate: "2027-02-01", localStartTime: "12:00", localEndTime: "13:00", overlayId, destinationIds: [targetId], enabled: true };
	const initialResult = await schedules.saveRunnerScheduleEventForPrincipal(principal, draft);
	if (!initialResult.success) return { authenticated: input.authenticated, saved: false, initial: initialResult };
	const initial = initialResult;
	const list = Reflect.get(schedules, "listRunnerScheduleEventsForPrincipal"),
		snapshot = Reflect.get(schedules, "getRunnerScheduleSnapshotForPrincipal");
	if (typeof list !== "function" || typeof snapshot !== "function") return { authenticated: input.authenticated, saved: true, readAvailable: false };
	const rows = async () => await list(principal, { ownerId, runnerId: input.runnerId });
	const readSnapshot = async (now: Date) => {
		const value = await snapshot(principal, { ownerId, runnerId: input.runnerId }, now);
		if (!value.success) throw new Error("SCHEDULE_SNAPSHOT_FIXTURE_DENIED:" + value.code);
		return value;
	};

	const observeSigned = (value: object) => {
		const bundle = Reflect.get(value, "bundle");
		if (!bundle || typeof bundle.payload !== "string" || typeof bundle.signature !== "string") return { present: false, verified: false, claims: null };
		return { present: true, verified: verify(null, Buffer.from(bundle.payload), publicKey, Buffer.from(bundle.signature, "base64url")), claims: JSON.parse(Buffer.from(bundle.payload, "base64url").toString()) };
	};
	const initialView = await rows();
	const authoringState = { desiredState: (await input.fixture.pool.query("SELECT desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].desired_state, admissions: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId])).rows[0].count) };
	const persisted = async () => ({
		events: (await input.fixture.pool.query("SELECT * FROM runner_schedule_events WHERE owner_id=$1 ORDER BY id", [ownerId])).rows,
		destinations: (await input.fixture.pool.query("SELECT * FROM runner_schedule_event_destinations WHERE owner_id=$1 ORDER BY event_id,position", [ownerId])).rows,
		successAudits: (await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE outcome='success' AND target_type='runner_schedule_event'")).rows[0].count,
	});

	async function observeCalendarBoundaries() {
		const vectors: Record<string, unknown> = {};
		const base = { ...draft, title: "Candidate", localStartDate: "2027-01-04", localEndDate: "2027-01-04" };
		for (const [key, patch] of Object.entries({
			title0: { title: "" },
			title1: { title: "T" },
			title80: { title: "T".repeat(80) },
			title81: { title: "T".repeat(81) },
			duration0: { localEndTime: "12:00" },
			duration24: { localEndDate: "2027-01-05", localEndTime: "12:00" },
			duration24plus1: { localEndDate: "2027-01-05", localEndTime: "12:01" },
			negative: { localEndTime: "11:59" },
			missingSource: { overlayId: undefined },
			missingTargets: { destinationIds: [] },
			badZone: { timezone: "Invalid/Nowhere" },
		})) {
			const before = await persisted();
			const result = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, ...patch });
			const after = await persisted();
			vectors[key] = { result, unchanged: JSON.stringify(before) === JSON.stringify(after) };
			// Accepted boundary candidates use their own date so subsequent vectors cannot overlap them.
			if (result.success) await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE owner_id=$1 AND id=$2", [ownerId, result.event.id]);
		}

		const malformed: Record<string, unknown> = {};
		for (const [key, patch] of Object.entries({ badDate: { localStartDate: "2027-02-30" }, badTime: { localStartTime: "25:00" }, malformedDate: { localEndDate: "tomorrow" }, missingDate: { localStartDate: undefined } })) {
			const before = await persisted();
			const direct = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, ...patch }).catch(() => ({ success: false, code: "UNEXPECTED_EXCEPTION" }));
			const action = await input.actions.saveRunnerScheduleEvent({ ...base, ...patch });
			malformed[key] = { direct, action, unchanged: JSON.stringify(before) === JSON.stringify(await persisted()) };
		}
		const vacation = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Vacation", timezone: "Europe/Berlin", localEndDate: "2027-01-13" });
		const activeCache = await readSnapshot(new Date("2027-01-10T12:00:00Z"));
		const dst = [];
		for (const [date, end] of [
			["2026-03-29", "2026-03-30"],
			["2026-10-25", "2026-10-26"],
		]) {
			const saved = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "DST", timezone: "Europe/Berlin", localStartDate: date, localEndDate: end, localStartTime: "00:00", localEndTime: "00:00" });
			const cache = await readSnapshot(new Date(date + "T00:00:00Z"));
			dst.push({ saved, cache });
		}
		return { vectors, base, malformed, vacation, activeCache, dst };
	}
	const { vectors, base, malformed, vacation, activeCache, dst } = await observeCalendarBoundaries();
	async function observeScheduleRevisions() {
		const beforeMove = await readSnapshot(new Date("2027-02-01T12:15:00Z"));
		const originalOccurrence = beforeMove.occurrences.find((row: { eventId: string }) => row.eventId === initial.event.id);
		const suppression = new Map([[originalOccurrence?.occurrenceId, "manual_stop"]]);
		const moved = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...draft, id: initial.event.id, expectedRevision: initial.event.configurationRevision, localStartDate: "2027-02-02", localEndDate: "2027-02-02" });
		const afterMove = await readSnapshot(new Date("2027-02-02T12:15:00Z"));
		const movedOccurrence = afterMove.occurrences.find((row: { eventId: string }) => row.eventId === initial.event.id);
		const identity = { moved, beforeId: originalOccurrence?.occurrenceId, afterId: movedOccurrence?.occurrenceId, suppression: suppression.get(movedOccurrence?.occurrenceId), beforeAnchor: originalOccurrence?.recurrenceAnchor, afterAnchor: movedOccurrence?.recurrenceAnchor };

		for (const temporary of [vacation, ...dst.map((row) => row.saved)]) if (temporary.success) await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE owner_id=$1 AND id=$2", [ownerId, temporary.event.id]);
		const weeklyDraft = { ...draft, title: "Weekly", timezone: "Europe/Berlin", recurrence: "weekly", localStartDate: "2026-03-22", localEndDate: null, localStartTime: "02:30", localEndTime: "03:30", weekdays: [7], endDayOffset: 0 };
		const weekly = await schedules.saveRunnerScheduleEventForPrincipal(principal, weeklyDraft);
		const weekCache = await readSnapshot(new Date("2026-03-22T00:00:00Z"));
		const spring = await readSnapshot(new Date("2026-03-28T12:00:00Z"));
		const fall = await readSnapshot(new Date("2026-10-24T12:00:00Z"));
		const midnight = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Midnight", timezone: "Europe/Berlin", localEndDate: "2027-01-05", localStartTime: "23:30", localEndTime: "00:30" });
		const midnightCache = await readSnapshot(new Date("2027-01-04T00:00:00Z"));
		const overlapBefore = await persisted();
		const overlap = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Adjacent overlap", timezone: "Europe/Berlin", localStartDate: "2027-01-05", localEndDate: "2027-01-05", localStartTime: "00:15", localEndTime: "01:00" });
		const overlapUnchanged = JSON.stringify(overlapBefore) === JSON.stringify(await persisted());
		const authoringClock = () => Date.parse("2026-03-21T12:00:00Z");
		const timezoneChange = weekly.success ? await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...weeklyDraft, id: weekly.event.id, expectedRevision: weekly.event.configurationRevision, timezone: "America/New_York" }, undefined, authoringClock) : weekly;
		const newWeekCache = await readSnapshot(new Date("2026-03-22T00:00:00Z"));
		const beforeStale = await persisted();
		const stale = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...draft, id: initial.event.id, expectedRevision: initial.event.configurationRevision, title: "Stale edit" });
		const staleUnchanged = JSON.stringify(beforeStale) === JSON.stringify(await persisted());
		const beforeFailure = await persisted();
		await input.fixture.pool.query("CREATE FUNCTION schedule_controlled_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private controlled schedule storage failure'; END $$");
		await input.fixture.pool.query("CREATE TRIGGER schedule_controlled_failure AFTER UPDATE ON runner_schedule_events FOR EACH ROW EXECUTE FUNCTION schedule_controlled_failure()");
		const rollback = await input.actions.saveRunnerScheduleEvent({ ...draft, id: initial.event.id, expectedRevision: initial.event.configurationRevision + 1, title: "Must roll back" });
		await input.fixture.pool.query("DROP FUNCTION schedule_controlled_failure() CASCADE");
		const rollbackUnchanged = JSON.stringify(beforeFailure) === JSON.stringify(await persisted());
		const raced = await Promise.all(["A", "B"].map((title) => schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Race " + title, localStartDate: "2027-03-03", localEndDate: "2027-03-03" })));
		return { beforeMove, identity, weeklyDraft, weekly, weekCache, spring, fall, midnight, midnightCache, overlap, overlapUnchanged, authoringClock, timezoneChange, newWeekCache, stale, staleUnchanged, rollback, rollbackUnchanged, raced };
	}
	const { beforeMove, identity, weeklyDraft, weekly, weekCache, spring, fall, midnight, midnightCache, overlap, overlapUnchanged, authoringClock, timezoneChange, newWeekCache, stale, staleUnchanged, rollback, rollbackUnchanged, raced } = await observeScheduleRevisions();
	async function observeSigningBoundaries() {
		const offsets = [];
		for (const offset of [-1, 0, 7, 8]) {
			const runner = randomUUID(),
				target = randomUUID(),
				session = randomUUID();
			await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Weekly boundary Runner',$3)", [runner, ownerId, randomUUID()]);
			await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Weekly target','custom','rtmp://127.0.0.1:1949/weekly')", [target, ownerId, runner]);
			await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [session, ownerId, runner, overlayId]);
			await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [session, target, ownerId]);
			const result = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...weeklyDraft, runnerId: runner, sessionId: session, destinationIds: [target], endDayOffset: offset, localStartTime: "00:00", localEndTime: offset === 0 ? "01:00" : "00:00" });
			offsets.push({ offset, result, count: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_schedule_events WHERE runner_id=$1", [runner])).rows[0].count) });
		}

		const signedObserved = observeSigned(beforeMove);
		const signingPem = process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
		delete process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
		const unsigned = await readSnapshot(new Date("2027-02-02T12:15:00Z"));
		process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = signingPem;
		const missingDevice = await snapshot(principal, { ownerId, runnerId: randomUUID() }, new Date("2027-02-02T12:15:00Z"));
		return { offsets, signedObserved, unsigned, missingDevice };
	}
	const { offsets, signedObserved, unsigned, missingDevice } = await observeSigningBoundaries();

	async function observeWeeklyIdentity() {
		const memberDraft = { ...draft, title: "Weekly members", recurrence: "weekly", timezone: "UTC", localStartDate: "2026-03-23", localEndDate: null, localStartTime: "16:00", localEndTime: "17:00", weekdays: [1, 3], endDayOffset: 0 };
		const memberCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, memberDraft);
		if (!memberCreated.success) throw new Error("WEEKDAY_IDENTITY_SETUP_DENIED");
		const membersBefore = await readSnapshot(new Date("2026-03-23T00:00:00Z"));
		const wednesdayBefore = membersBefore.occurrences.find((row) => row.eventId === memberCreated.event.id && row.startUtc === "2026-03-25T16:00:00.000Z");
		const memberRemoved = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...memberDraft, id: memberCreated.event.id, expectedRevision: memberCreated.event.configurationRevision, weekdays: [3] }, undefined, authoringClock);
		const membersAfter = await readSnapshot(new Date("2026-03-23T00:00:00Z"));
		const wednesdayAfter = membersAfter.occurrences.find((row) => row.eventId === memberCreated.event.id && row.startUtc === "2026-03-25T16:00:00.000Z");
		const futureBefore = await readSnapshot(new Date("2026-03-30T00:00:00Z"));
		const memberAdvanced = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...memberDraft, id: memberCreated.event.id, expectedRevision: memberCreated.event.configurationRevision + 1, weekdays: [3], localStartDate: "2026-03-30" }, undefined, authoringClock);
		const futureAfter = await readSnapshot(new Date("2026-03-30T00:00:00Z"));
		const weeklyIdentity = { memberRemoved, memberAdvanced, before: wednesdayBefore?.occurrenceId, after: wednesdayAfter?.occurrenceId, futureBefore: futureBefore.occurrences.filter((row) => row.eventId === memberCreated.event.id).map((row) => row.occurrenceId), futureAfter: futureAfter.occurrences.filter((row) => row.eventId === memberCreated.event.id).map((row) => row.occurrenceId) };

		const scheduleOnlyTarget = await input.actions.saveRunnerDestination({ ownerId, runnerId: input.runnerId, name: "Schedule-only target", provider: "custom", rtmpUrl: "rtmp://127.0.0.1:1950/schedule", credentialAction: "clear" });
		if (!scheduleOnlyTarget.success) throw new Error("SCHEDULE_REFERENCE_TARGET_SETUP_FAILED");
		const scheduleOnlyEvent = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...draft, title: "Only scheduled target", localStartDate: "2027-04-01", localEndDate: "2027-04-01", localStartTime: "19:00", localEndTime: "20:00", destinationIds: [scheduleOnlyTarget.destination.id] });
		if (!scheduleOnlyEvent.success) throw new Error("SCHEDULE_REFERENCE_EVENT_SETUP_FAILED");
		const beforeTargetDelete = await persisted();
		const deleteScheduledTarget = await input.actions.deleteRunnerDestination({ ownerId, id: scheduleOnlyTarget.destination.id, expectedRevision: scheduleOnlyTarget.destination.configurationRevision });
		const scheduleReference = { attempted: deleteScheduledTarget, unchanged: JSON.stringify(beforeTargetDelete) === JSON.stringify(await persisted()), targetRetained: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_destinations WHERE owner_id=$1 AND id=$2", [ownerId, scheduleOnlyTarget.destination.id])).rows[0].count) === 1, eventId: scheduleOnlyEvent.event.id };
		return { weeklyIdentity, scheduleReference };
	}
	const { weeklyIdentity, scheduleReference } = await observeWeeklyIdentity();

	async function observeReadAndExpiryBounds() {
		const boundaryCases: Record<string, unknown> = {};
		const invalidCases: Record<string, unknown> = {
			missingRevision: { ...draft, id: initial.event.id },
			missingEnd: { ...base, localEndDate: null },
			emptyWeekdays: { ...weeklyDraft, weekdays: [] },
			selfOverlap: { ...weeklyDraft, weekdays: [1, 2], endDayOffset: 2 },
			missingEvent: { ...base, id: randomUUID(), expectedRevision: 1 },
			unknownRunner: { ...base, runnerId: randomUUID() },
			unknownSession: { ...base, sessionId: randomUUID() },
			unknownSource: { ...base, overlayId: randomUUID() },
			unknownTarget: { ...base, destinationIds: [randomUUID()] },
			primitive: null,
			invalidOwner: { ...base, ownerId: "" },
			foreignOwner: { ...base, ownerId: "foreign-schedule-owner" },
		};
		for (const [key, candidate] of Object.entries(invalidCases)) {
			const before = await persisted();
			const result = await schedules.saveRunnerScheduleEventForPrincipal(principal, candidate);
			boundaryCases[key] = { result, unchanged: JSON.stringify(before) === JSON.stringify(await persisted()) };
		}
		const emptyRunner = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Empty calendar Runner',$3)", [emptyRunner, ownerId, randomUUID()]);
		const emptyList = await list(principal, { ownerId, runnerId: emptyRunner });
		const emptySnapshot = await snapshot(principal, { ownerId, runnerId: emptyRunner });
		const badRead = await list(principal, { ownerId, runnerId: "invalid" });
		const untrustedClock = await snapshot(principal, { ownerId, runnerId: emptyRunner, now: "2099-01-01T00:00:00Z" });
		const disabled = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Disabled overlapping draft", localStartDate: "2027-03-03", localEndDate: "2027-03-03", enabled: false });
		const disabledCache = await readSnapshot(new Date("2027-03-03T12:15:00Z"));
		const boundedId = randomUUID(),
			knownEnd = new Date(Date.now() + 3600000);
		await input.fixture.pool.query("INSERT INTO billing_subscriptions(id,user_id,stripe_customer_id,status,current_period_end,cancel_at_period_end) VALUES($1,$2,'isolated-bounded-schedule','active',$3,true)", [boundedId, ownerId, knownEnd]);
		await input.fixture.pool.query("INSERT INTO billing_subscription_items(id,subscription_id,product_key,stripe_product_id,stripe_price_id,currency,billing_interval) VALUES($1,$2,'pro','isolated-pro','isolated-price','usd','month')", [randomUUID(), boundedId]);
		const boundedCache = await snapshot(principal, { ownerId, runnerId: emptyRunner });
		if (!boundedCache.success) throw new Error("BOUNDED_CALENDAR_FIXTURE_DENIED");
		const boundedSigned = observeSigned(boundedCache);
		await input.fixture.pool.query("DELETE FROM billing_subscriptions WHERE id=$1", [boundedId]);
		return { boundaryCases, emptyList, emptySnapshot, badRead, untrustedClock, disabled, disabledCache, knownEnd, boundedSigned };
	}
	const { boundaryCases, emptyList, emptySnapshot, badRead, untrustedClock, disabled, disabledCache, knownEnd, boundedSigned } = await observeReadAndExpiryBounds();

	// Live-lock cases must not collide with the historical recurrence examples.
	async function observeLiveEditLocks() {
		const activeRunnerId = randomUUID(),
			activeSessionId = randomUUID(),
			activeTargetId = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Active lock fixture',$3)", [activeRunnerId, ownerId, randomUUID()]);
		await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Active lock target','custom','rtmp://127.0.0.1:1949/active')", [activeTargetId, ownerId, activeRunnerId]);
		await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [activeSessionId, ownerId, activeRunnerId, overlayId]);
		await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [activeSessionId, activeTargetId, ownerId]);
		const activeStart = new Date(Date.now() - 3600000).toISOString(),
			activeEnd = new Date(Date.now() + 3600000).toISOString();
		const activeDraft = { ...draft, runnerId: activeRunnerId, sessionId: activeSessionId, destinationIds: [activeTargetId], title: "Active locked event", localStartDate: activeStart.slice(0, 10), localEndDate: activeEnd.slice(0, 10), localStartTime: activeStart.slice(11, 16), localEndTime: activeEnd.slice(11, 16) };
		const activeCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, activeDraft);
		if (!activeCreated.success) throw new Error("ACTIVE_SCHEDULE_FIXTURE_DENIED:" + activeCreated.code);
		const activeEdits: Record<string, unknown> = {};
		for (const boundary of ["service", "action"])
			for (const [kind, patch] of Object.entries({ move: { localStartDate: "2028-01-01", localEndDate: "2028-01-01" }, resize: { localEndDate: new Date(Date.now() + 7200000).toISOString().slice(0, 10), localEndTime: new Date(Date.now() + 7200000).toISOString().slice(11, 16) }, configuration: { title: "Changed live configuration", enabled: false } })) {
				await input.fixture.pool.query("UPDATE runner_schedule_events SET local_start_date=$1,local_end_date=$2,local_start_time=$3,local_end_time=$4,title=$5,enabled=true,configuration_revision=1 WHERE id=$6", [activeDraft.localStartDate, activeDraft.localEndDate, activeDraft.localStartTime, activeDraft.localEndTime, activeDraft.title, activeCreated.event.id]);
				const before = await persisted();
				const change = { ...activeDraft, id: activeCreated.event.id, expectedRevision: 1, ...patch };
				const result = boundary === "service" ? await schedules.saveRunnerScheduleEventForPrincipal(principal, change) : await input.actions.saveRunnerScheduleEvent(change);
				activeEdits[boundary + ":" + kind] = { result, unchanged: JSON.stringify(before) === JSON.stringify(await persisted()) };
			}
		const activeDeleteBefore = await persisted();
		const activeDelete = await schedules.deleteRunnerScheduleEventForPrincipal(principal, { ownerId, runnerId: activeRunnerId, id: activeCreated.event.id, expectedRevision: 1 });
		const activeDeleteUnchanged = JSON.stringify(activeDeleteBefore) === JSON.stringify(await persisted());
		const endedStart = new Date(Date.now() - 7200000).toISOString(),
			endedEnd = new Date(Date.now() - 60000).toISOString();
		const endedDraft = { ...activeDraft, localStartDate: endedStart.slice(0, 10), localEndDate: endedEnd.slice(0, 10), localStartTime: endedStart.slice(11, 16), localEndTime: endedEnd.slice(11, 16) };
		const resetEnded = () => input.fixture.pool.query("UPDATE runner_schedule_events SET local_start_date=$1,local_end_date=$2,local_start_time=$3,local_end_time=$4,title=$5,enabled=true,configuration_revision=1 WHERE id=$6", [endedDraft.localStartDate, endedDraft.localEndDate, endedDraft.localStartTime, endedDraft.localEndTime, endedDraft.title, activeCreated.event.id]);
		await resetEnded();
		const drainingAdmission = randomUUID();
		await input.fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,occurrence_id,state,configuration_revision,benefits_at_start,scheduled_end) VALUES($1,$2,$3,$4,$5,$6,'draining',1,$7::jsonb,$8)", [drainingAdmission, ownerId, activeRunnerId, activeSessionId, randomUUID(), JSON.stringify([activeCreated.event.id, activeCreated.event.recurrenceAnchor]), JSON.stringify({ runnerPro: true }), endedEnd]);
		const drainingBefore = await persisted();
		const drainingEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...endedDraft, id: activeCreated.event.id, expectedRevision: 1, title: "Edited during drain" });
		const drainingUnchanged = JSON.stringify(drainingBefore) === JSON.stringify(await persisted());
		await resetEnded();
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped',stopped_at=now() WHERE id=$1", [drainingAdmission]);
		const afterClosureEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...endedDraft, id: activeCreated.event.id, expectedRevision: 1, title: "Editable after closure" });
		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE id=$1", [drainingAdmission]);
		await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE id=$1", [activeCreated.event.id]);
		return { activeEdits, activeDelete, activeDeleteUnchanged, drainingEdit, drainingUnchanged, afterClosureEdit };
	}
	const { activeEdits, activeDelete, activeDeleteUnchanged, drainingEdit, drainingUnchanged, afterClosureEdit } = await observeLiveEditLocks();

	async function observeCalendarAuthoring() {
		const deletable = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Deletable future event", localStartDate: "2029-01-04", localEndDate: "2029-01-04" });
		if (!deletable.success) throw new Error("DELETE_SCHEDULE_FIXTURE_DENIED:" + deletable.code);
		const deleteInput = { ownerId, runnerId: input.runnerId, id: deletable.event.id, expectedRevision: 1 };
		const staleDeleteBefore = await persisted();
		const staleDelete = await input.actions.deleteRunnerScheduleEvent({ ...deleteInput, expectedRevision: 2 });
		const staleDeleteUnchanged = JSON.stringify(staleDeleteBefore) === JSON.stringify(await persisted());
		const deletedEvent = await schedules.deleteRunnerScheduleEventForPrincipal(principal, deleteInput);
		const deletedRows = (await input.fixture.pool.query("SELECT id FROM runner_schedule_events WHERE id=$1", [deletable.event.id])).rows.length;
		const deletedJoins = (await input.fixture.pool.query("SELECT event_id FROM runner_schedule_event_destinations WHERE event_id=$1", [deletable.event.id])).rows.length;
		const deletionAudits = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='runner.schedule.delete' AND target_id=$1 AND outcome='success'", [deletable.event.id])).rows[0].count);
		const moveCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Keyboard move", localStartDate: "2031-01-04", localEndDate: "2031-01-04" });
		if (!moveCreated.success) throw new Error("KEYBOARD_MOVE_FIXTURE_DENIED:" + moveCreated.code);
		const keyboardMove = await input.actions.saveRunnerScheduleEvent({ ...base, title: "Keyboard move", localStartDate: "2031-01-04", localEndDate: "2031-01-04", localStartTime: "13:00", localEndTime: "14:00", id: moveCreated.event.id, expectedRevision: 1 });
		const keyboardMoveJoins = (await input.fixture.pool.query("SELECT destination_id FROM runner_schedule_event_destinations WHERE event_id=$1", [moveCreated.event.id])).rows;
		if (!keyboardMove.success) throw new Error("KEYBOARD_MOVE_BASELINE_DENIED:" + keyboardMove.code);
		const resizeInput = { ...base, title: "Keyboard resize", localStartDate: "2031-01-04", localEndDate: "2031-01-04", localStartTime: "13:00", localEndTime: "15:00", id: moveCreated.event.id, expectedRevision: keyboardMove.event.configurationRevision };
		const keyboardResize = await input.actions.saveRunnerScheduleEvent(resizeInput);
		if (!keyboardResize.success) throw new Error("KEYBOARD_RESIZE_BASELINE_DENIED:" + keyboardResize.code);
		const badResizeBefore = await persisted();
		const keyboardInvalidResize = await input.actions.saveRunnerScheduleEvent({ ...resizeInput, expectedRevision: keyboardResize.event.configurationRevision, localEndTime: "12:00" });
		const keyboardInvalidResizeUnchanged = JSON.stringify(badResizeBefore) === JSON.stringify(await persisted());
		const formCreate = await input.actions.saveRunnerScheduleEvent({ ...base, title: "Keyboard authored", localStartDate: "2033-01-04", localEndDate: "2033-01-04" });
		if (!formCreate.success) throw new Error("KEYBOARD_AUTHORING_BASELINE_DENIED:" + formCreate.code);
		const formCreateJoins = (await input.fixture.pool.query("SELECT destination_id FROM runner_schedule_event_destinations WHERE event_id=$1", [formCreate.event.id])).rows;
		const metadataCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Pointer metadata", localStartDate: "2034-01-04", localEndDate: "2034-01-04" });
		if (!metadataCreated.success) throw new Error("METADATA_FIXTURE_DENIED:" + metadataCreated.code);
		const pointerMetadataEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Renamed pointer", localStartDate: "2034-01-04", localEndDate: "2034-01-04", id: metadataCreated.event.id, expectedRevision: 1 });
		if (!pointerMetadataEdit.success) throw new Error("METADATA_BASELINE_DENIED:" + pointerMetadataEdit.code);
		const keyboardMetadataEdit = await input.actions.saveRunnerScheduleEvent({ ...base, title: "Renamed keyboard", timezone: "America/New_York", localStartDate: "2034-01-04", localEndDate: "2034-01-04", id: metadataCreated.event.id, expectedRevision: 2 });
		const metadataJoins = (await input.fixture.pool.query("SELECT destination_id FROM runner_schedule_event_destinations WHERE event_id=$1", [metadataCreated.event.id])).rows;
		return { staleDelete, staleDeleteUnchanged, deletedEvent, deletedRows, deletedJoins, deletionAudits, moveCreated, keyboardMove, keyboardMoveJoins, keyboardResize, keyboardInvalidResize, keyboardInvalidResizeUnchanged, formCreate, formCreateJoins, metadataCreated, pointerMetadataEdit, keyboardMetadataEdit, metadataJoins };
	}
	const { staleDelete, staleDeleteUnchanged, deletedEvent, deletedRows, deletedJoins, deletionAudits, moveCreated, keyboardMove, keyboardMoveJoins, keyboardResize, keyboardInvalidResize, keyboardInvalidResizeUnchanged, formCreate, formCreateJoins, metadataCreated, pointerMetadataEdit, keyboardMetadataEdit, metadataJoins } = await observeCalendarAuthoring();
	async function observeActivationBoundary() {
		const activation = Date.parse("2032-01-04T12:00:00Z");
		const activationDraft = { ...base, title: "Activation boundary", localStartDate: "2032-01-04", localEndDate: "2032-01-04" };
		const activationCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, activationDraft);
		if (!activationCreated.success) throw new Error("ACTIVATION_FIXTURE_DENIED:" + activationCreated.code);
		const beforeActivationEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...activationDraft, id: activationCreated.event.id, expectedRevision: 1, title: "Allowed before activation" }, undefined, () => activation - 1);
		if (!beforeActivationEdit.success) throw new Error("BEFORE_ACTIVATION_EDIT_DENIED:" + beforeActivationEdit.code);
		const activationBefore = await persisted();
		const activationInput = { ...activationDraft, id: activationCreated.event.id, expectedRevision: beforeActivationEdit.event.configurationRevision, title: "Denied at activation" };
		const exactActivationEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, activationInput, undefined, () => activation);
		const exactActivationEditUnchanged = JSON.stringify(activationBefore) === JSON.stringify(await persisted());
		const exactActivationDelete = await schedules.deleteRunnerScheduleEventForPrincipal(principal, { ownerId, runnerId: input.runnerId, id: activationCreated.event.id, expectedRevision: beforeActivationEdit.event.configurationRevision }, undefined, () => activation);
		const exactActivationDeleteUnchanged = JSON.stringify(activationBefore) === JSON.stringify(await persisted());
		await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE id=$1", [activationCreated.event.id]);
		return { beforeActivationEdit, exactActivationEdit, exactActivationEditUnchanged, exactActivationDelete, exactActivationDeleteUnchanged };
	}
	const { beforeActivationEdit, exactActivationEdit, exactActivationEditUnchanged, exactActivationDelete, exactActivationDeleteUnchanged } = await observeActivationBoundary();
	async function observeScheduledResume() {
		const { controlStreamSession } = await import("@/server/resources/runners");
		// Earlier recurring examples must not overlap this wall-clock resume fixture.
		// Retain their rows for the later expired-entitlement read assertions.
		await input.fixture.pool.query("UPDATE runner_schedule_events SET enabled=false WHERE owner_id=$1 AND runner_id=$2", [ownerId, input.runnerId]);
		const resumeEndEpoch = Math.floor((Date.now() + 3600000) / 60000) * 60000;
		const resumeStart = new Date(resumeEndEpoch - 7200000).toISOString(),
			resumeEnd = new Date(resumeEndEpoch).toISOString();
		const resumeCreated = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Resumable occurrence", localStartDate: resumeStart.slice(0, 10), localEndDate: resumeEnd.slice(0, 10), localStartTime: resumeStart.slice(11, 16), localEndTime: resumeEnd.slice(11, 16) });
		if (!resumeCreated.success) throw new Error("RESUME_WINDOW_FIXTURE_DENIED:" + resumeCreated.code);
		const resumeOccurrenceId = JSON.stringify([resumeCreated.event.id, resumeCreated.event.recurrenceAnchor]);
		await input.fixture.pool.query("UPDATE runners SET protocol_version=2,capabilities=$1::jsonb WHERE id=$2", [JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"]), input.runnerId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET rtmp_url='rtmp://127.0.0.1:1949/live',desired_state='stopped',actual_state='stopped',configuration_revision=10 WHERE id=$1", [sessionId]);
		const stoppedAdmission = randomUUID();
		await input.fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,occurrence_id,state,configuration_revision,benefits_at_start,scheduled_end,terminal_reason,stopped_at) VALUES($1,$2,$3,$4,$5,$6,'stopped',9,$7::jsonb,$8,'manual_stop',now())", [stoppedAdmission, ownerId, input.runnerId, sessionId, randomUUID(), resumeOccurrenceId, JSON.stringify({ runnerPro: true, ingestModeAtStart: "24/7" }), resumeEnd]);
		const controlState = async () => ({
			session: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision,control_mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0],
			admissions: (await input.fixture.pool.query("SELECT id,state,execution_generation,occurrence_id,configuration_revision,scheduled_end,terminal_reason FROM runner_broadcast_admissions WHERE session_id=$1 ORDER BY id", [sessionId])).rows,
			audits: Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE target_id=$1 AND outcome='success'", [sessionId])).rows[0].count),
		});
		const resumeInput = { creatorId: ownerId, sessionId, state: "running", expectedRevision: 10, occurrenceId: resumeOccurrenceId };
		const resumedBeforeEnd = await Reflect.apply(controlStreamSession, undefined, [principal, resumeInput, undefined, () => resumeEndEpoch - 1]);
		const beforeEndState = await controlState();
		const resumedCache = observeSigned(await readSnapshot(new Date(resumeEndEpoch - 1)));
		const { issueFreeExecutionLease: issueResumeLease } = await import("@/server/runner/lease");
		const resumeDeviceToken = (await input.fixture.pool.query("SELECT token FROM runners WHERE id=$1", [input.runnerId])).rows[0].token;
		const resumePermission = await issueResumeLease({ id: input.runnerId, ownerId, token: resumeDeviceToken }, sessionId, randomUUID(), input.fixture.db);
		const resumedExecution = resumePermission ? { signed: observeSigned({ bundle: resumePermission.lease }), job: { occurrenceId: Reflect.get(resumePermission, "occurrenceId"), scheduledStart: Reflect.get(resumePermission, "scheduledStart"), scheduledEnd: resumePermission.scheduledEnd, configurationRevision: resumePermission.configurationRevision }, expectedStart: Date.parse(resumeStart), expectedEnd: resumeEndEpoch } : null;

		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1 AND id<>$2", [sessionId, stoppedAdmission]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',configuration_revision=10 WHERE id=$1", [sessionId]);
		const atEndBefore = await controlState();
		const resumedAtEnd = await Reflect.apply(controlStreamSession, undefined, [principal, resumeInput, undefined, () => resumeEndEpoch]);
		const atEndUnchanged = JSON.stringify(atEndBefore) === JSON.stringify(await controlState());
		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1 AND id<>$2", [sessionId, stoppedAdmission]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',configuration_revision=10 WHERE id=$1", [sessionId]);
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='draining',stopped_at=null WHERE id=$1", [stoppedAdmission]);
		const unclosedBefore = await controlState();
		let resumedBeforeClosure;
		try {
			resumedBeforeClosure = await Reflect.apply(controlStreamSession, undefined, [principal, resumeInput, undefined, () => resumeEndEpoch - 1]);
		} catch (cause) {
			if (cause instanceof Error && cause.message === "RUNNER_RECOVERY_REQUIRED") resumedBeforeClosure = { error: { code: cause.message }, legacyThrown: true };
			else throw cause;
		}
		const beforeClosureUnchanged = JSON.stringify(unclosedBefore) === JSON.stringify(await controlState());
		const stopObservations = [];
		for (const state of ["active", "reserved"] as const) {
			await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state=$2,configuration_revision=10 WHERE id=$1", [sessionId, state === "active" ? "running" : "stopped"]);
			await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state=$2::runner_admission_state,stopped_at=null,terminal_reason=null,dispatched_at=CASE WHEN $2::text='active' THEN now() ELSE null END,benefits_at_start=$3::jsonb WHERE id=$1", [stoppedAdmission, state, JSON.stringify({ runnerPro: true, ingestModeAtStart: "24/7" })]);
			const result = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "stopped", expectedRevision: 10, stopMode: "graceful" });
			const admission = (await input.fixture.pool.query("SELECT state,occurrence_id,scheduled_end,benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [stoppedAdmission])).rows[0];
			const session = (await controlState()).session;
			const edit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, id: resumeCreated.event.id, expectedRevision: resumeCreated.event.configurationRevision, title: "Cannot reset suppression", localStartDate: resumeStart.slice(0, 10), localEndDate: resumeEnd.slice(0, 10), localStartTime: resumeStart.slice(11, 16), localEndTime: resumeEnd.slice(11, 16) });
			const stoppedCache = observeSigned(await readSnapshot(new Date(resumeEndEpoch - 1)));
			stopObservations.push({ initialState: state, result, admission, session, edit, stoppedCache });
		}
		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId]);
		await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE id=$1", [resumeCreated.event.id]);
		return { controlStreamSession, resumeStart, resumeEnd, resumeOccurrenceId, stoppedAdmission, resumedBeforeEnd, beforeEndState, resumedCache, resumedExecution, resumedAtEnd, atEndUnchanged, resumedBeforeClosure, beforeClosureUnchanged, stopObservations };
	}
	const { controlStreamSession, resumeStart, resumeEnd, resumeOccurrenceId, stoppedAdmission, resumedBeforeEnd, beforeEndState, resumedCache, resumedExecution, resumedAtEnd, atEndUnchanged, resumedBeforeClosure, beforeClosureUnchanged, stopObservations } = await observeScheduledResume();
	async function observeCapturedSources() {
		const eventTargetId = randomUUID(),
			eventSourceId = randomUUID();
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,configuration_revision) VALUES($1,$2,'captured-source-secret','Occurrence-only source','active','Featured',7)", [eventSourceId, ownerId]);
		await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Occurrence-only target','custom','rtmp://127.0.0.1:1950/event')", [eventTargetId, ownerId, input.runnerId]);
		const targetEvent = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Captured event target", overlayId: eventSourceId, localStartDate: resumeStart.slice(0, 10), localEndDate: resumeEnd.slice(0, 10), localStartTime: resumeStart.slice(11, 16), localEndTime: resumeEnd.slice(11, 16), destinationIds: [eventTargetId] });
		if (!targetEvent.success) throw new Error("EVENT_TARGET_FIXTURE_DENIED:" + targetEvent.code);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',configuration_revision=20 WHERE id=$1", [sessionId]);
		const eventTargetStart = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "running", expectedRevision: 20 });
		const targetCapture = (await input.fixture.pool.query("SELECT target_ids_snapshot FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId])).rows;
		const unchangedDefaultTargets = (await input.fixture.pool.query("SELECT destination_id FROM stream_session_destinations WHERE session_id=$1 ORDER BY position", [sessionId])).rows;
		const { issueFreeExecutionLease } = await import("@/server/runner/lease");
		const deviceToken = (await input.fixture.pool.query("SELECT token FROM runners WHERE id=$1", [input.runnerId])).rows[0].token;
		const eventLease = await issueFreeExecutionLease({ id: input.runnerId, ownerId, token: deviceToken }, sessionId, randomUUID(), input.fixture.db);
		const { POST: heartbeatPost } = await import("@/app/api/runner/heartbeat/route");
		const heartbeatResponse = await heartbeatPost(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId: randomUUID(), capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
		const heartbeatBody = await heartbeatResponse.json();
		const eventJob = heartbeatBody.jobs?.find((job: { id: string }) => job.id === sessionId);
		const heartbeatSource = { status: heartbeatResponse.status, overlayId: eventJob?.overlayId, sourceRevision: eventJob?.sourceRevision, correctPrivateSource: eventJob?.overlaySecret === "captured-source-secret", signed: observeSigned({ bundle: eventJob?.lease }) };
		const eventTargetCapture = { heartbeatSource, lease: observeSigned({ bundle: eventLease?.lease }), expectedEventSource: eventSourceId, expectedSourceRevision: 7, start: eventTargetStart, captures: targetCapture, defaults: unchangedDefaultTargets, expectedEventTarget: eventTargetId, expectedDefaultTarget: targetId };
		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped' WHERE id=$1", [sessionId]);
		await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE id=$1", [targetEvent.event.id]);
		await input.fixture.pool.query("UPDATE stream_sessions SET control_mode='manual',configuration_revision=30 WHERE id=$1", [sessionId]);
		const manualStart = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "running", expectedRevision: 30 });
		const beforeSourceEdit = await issueFreeExecutionLease({ id: input.runnerId, ownerId, token: deviceToken }, sessionId, randomUUID(), input.fixture.db);
		await input.fixture.pool.query("UPDATE overlays SET configuration_revision=configuration_revision+1 WHERE id=$1", [overlayId]);
		const afterSourceEdit = await issueFreeExecutionLease({ id: input.runnerId, ownerId, token: deviceToken }, sessionId, randomUUID(), input.fixture.db);
		const manualSourceCapture = { start: manualStart, before: observeSigned({ bundle: beforeSourceEdit?.lease }), after: observeSigned({ bundle: afterSourceEdit?.lease }), expectedSource: overlayId };
		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',control_mode='scheduled' WHERE id=$1", [sessionId]);
		return { eventTargetId, eventSourceId, deviceToken, heartbeatPost, eventTargetCapture, manualSourceCapture };
	}
	const { eventTargetId, eventSourceId, deviceToken, heartbeatPost, eventTargetCapture, manualSourceCapture } = await observeCapturedSources();
	async function prepareOfflineAuthority() {
		const cacheStartEpoch = Math.floor((Date.now() + 120000) / 60000) * 60000;
		const cacheStart = new Date(cacheStartEpoch).toISOString(),
			cacheEnd = new Date(cacheStartEpoch + 300000).toISOString();
		const cachedEvent = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Offline authorized event", overlayId: eventSourceId, destinationIds: [eventTargetId], localStartDate: cacheStart.slice(0, 10), localEndDate: cacheEnd.slice(0, 10), localStartTime: cacheStart.slice(11, 16), localEndTime: cacheEnd.slice(11, 16) });
		if (!cachedEvent.success) throw new Error("OFFLINE_EVENT_FIXTURE_DENIED:" + cachedEvent.code);
		// Recovery observes a separate future authorization, independent of earlier recurrence examples.
		const recoveryStart = new Date(cacheStartEpoch + 600000).toISOString();
		const recoveryEnd = new Date(cacheStartEpoch + 900000).toISOString();
		const recoveryEvent = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Future recovery occurrence", overlayId: eventSourceId, destinationIds: [eventTargetId], localStartDate: recoveryStart.slice(0, 10), localEndDate: recoveryEnd.slice(0, 10), localStartTime: recoveryStart.slice(11, 16), localEndTime: recoveryEnd.slice(11, 16) });
		if (!recoveryEvent.success) throw new Error("FUTURE_RECOVERY_EVENT_FIXTURE_DENIED:" + recoveryEvent.code);
		const cacheHeartbeat = await heartbeatPost(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId: randomUUID(), capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease", "schedule_cache"] }) }));
		const cacheBody = await cacheHeartbeat.json();
		const offlineAuthorization = {
			status: cacheHeartbeat.status,
			cache: cacheBody.scheduleCache ?? null,
			eventId: cachedEvent.event.id,
			expectedSource: eventSourceId,
			expectedTarget: eventTargetId,
			sessionId,
			session: (await input.fixture.pool.query("SELECT desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0],
			admissions: (await input.fixture.pool.query("SELECT state,occurrence_id,scheduled_end,target_ids_snapshot,benefits_at_start FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId])).rows,
		};
		return { cacheStartEpoch, cacheStart, cacheEnd, cachedEvent, cacheBody, offlineAuthorization };
	}
	const { cacheStartEpoch, cacheStart, cacheEnd, cachedEvent, cacheBody, offlineAuthorization } = await prepareOfflineAuthority();
	async function observeFutureAuthority() {
		const beforeDeviceDenials = JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE owner_id=$1 ORDER BY id", [ownerId])).rows);
		const deniedCacheRequests = [];
		for (const [name, identity, nonce] of [
			["wrong token", { id: input.runnerId, ownerId, token: "wrong-bearer" }, randomUUID()],
			["wrong owner", { id: input.runnerId, ownerId: "absent-owner", token: deviceToken }, randomUUID()],
			["invalid nonce", { id: input.runnerId, ownerId, token: deviceToken }, "invalid"],
		] as const) {
			deniedCacheRequests.push({ name, denied: (await schedules.issueRunnerScheduleCache(identity, nonce, input.fixture.db)) === null, unchanged: beforeDeviceDenials === JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE owner_id=$1 ORDER BY id", [ownerId])).rows) });
		}
		Reflect.set(offlineAuthorization, "deviceDenials", deniedCacheRequests);
		Reflect.set(offlineAuthorization, "signedManifest", observeSigned({ bundle: cacheBody.scheduleCache?.bundle }));
		Reflect.set(offlineAuthorization, "signedExecutions", cacheBody.scheduleCache?.entries.map((entry: { job: { lease: object } }) => observeSigned({ bundle: entry.job.lease })) ?? []);
		const futureAuthorizedEdit = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, id: cachedEvent.event.id, expectedRevision: cachedEvent.event.configurationRevision, title: "Edited before activation", overlayId: eventSourceId, destinationIds: [eventTargetId], localStartDate: cacheStart.slice(0, 10), localEndDate: cacheEnd.slice(0, 10), localStartTime: cacheStart.slice(11, 16), localEndTime: cacheEnd.slice(11, 16) });
		Reflect.set(offlineAuthorization, "futureEdit", futureAuthorizedEdit);
		await input.fixture.pool.query("UPDATE stream_sessions SET control_mode='manual',configuration_revision=40 WHERE id=$1", [sessionId]);
		const independentManualStart = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "running", expectedRevision: 40 });
		const independentAdmissions = (await input.fixture.pool.query("SELECT state,occurrence_id,target_ids_snapshot FROM runner_broadcast_admissions WHERE session_id=$1 ORDER BY state", [sessionId])).rows;
		Reflect.set(offlineAuthorization, "independentManual", { result: independentManualStart, admissions: independentAdmissions, expectedDefaultTarget: targetId });
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),started_at=now() WHERE session_id=$1 AND state='reserved'", [sessionId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='running' WHERE id=$1", [sessionId]);
		const futureReceiptRow = (await input.fixture.pool.query("SELECT id,execution_generation,lease_id,configuration_revision FROM runner_broadcast_admissions WHERE session_id=$1 AND occurrence_id LIKE $2", [sessionId, `%${cachedEvent.event.id}%`])).rows[0];
		const { acknowledgeFreeExecutions } = await import("@/server/runner/lease");
		const futureReceiptAccepted = await acknowledgeFreeExecutions({ id: input.runnerId, ownerId, token: deviceToken }, [{ admissionId: futureReceiptRow.id, sessionId, executionGeneration: futureReceiptRow.execution_generation, leaseId: futureReceiptRow.lease_id, configurationRevision: futureReceiptRow.configuration_revision, state: "stopped", allOutputsClosed: true }], input.fixture.db);
		Reflect.set(offlineAuthorization, "futureReceipt", { accepted: futureReceiptAccepted, expectedAdmission: futureReceiptRow.id, session: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionId])).rows[0] });
		const manualStopWithFuture = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "stopped", expectedRevision: 41 }).catch((cause: unknown) => {
			let current: unknown = cause;
			for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
				if (Reflect.get(current, "code") === "23505" && Reflect.get(current, "constraint") === "runner_admissions_open_session_unique") return { accepted: false, error: { code: "POSTGRES_CONSTRAINT", constraint: "runner_admissions_open_session_unique" } };
				current = Reflect.get(current, "cause");
			}
			throw cause;
		});
		const futureAfterManualStop = (await input.fixture.pool.query("SELECT state,occurrence_id FROM runner_broadcast_admissions WHERE session_id=$1 AND occurrence_id IS NOT NULL AND state<>'stopped' ORDER BY occurrence_id", [sessionId])).rows;
		Reflect.set(offlineAuthorization, "manualStop", { result: manualStopWithFuture, future: futureAfterManualStop });
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped',stopped_at=now() WHERE session_id=$1 AND state='draining'", [sessionId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',control_mode='scheduled' WHERE id=$1", [sessionId]);
		return { acknowledgeFreeExecutions };
	}
	const { acknowledgeFreeExecutions } = await observeFutureAuthority();
	async function observeActiveAuthority() {
		const refreshedAuthority = await schedules.issueRunnerScheduleCache({ id: input.runnerId, ownerId, token: deviceToken }, randomUUID(), input.fixture.db);
		const dueJob = refreshedAuthority?.entries.find((entry) => entry.job.occurrenceId?.includes(cachedEvent.event.id))?.job;
		if (!dueJob) throw new Error("DUE_AUTHORIZATION_FIXTURE_MISSING");
		const dueLease = JSON.parse(Buffer.from(dueJob.lease.payload, "base64url").toString("utf8"));
		const activeReceipt = { admissionId: dueJob.admissionId, sessionId, executionGeneration: dueJob.executionGeneration, leaseId: dueLease.leaseId, configurationRevision: dueJob.configurationRevision, state: "active" as const };
		const beforeWindowReceipt = await Reflect.apply(acknowledgeFreeExecutions, undefined, [{ id: input.runnerId, ownerId, token: deviceToken }, [activeReceipt], input.fixture.db, () => cacheStartEpoch - 1]);
		const atWindowReceipt = await Reflect.apply(acknowledgeFreeExecutions, undefined, [{ id: input.runnerId, ownerId, token: deviceToken }, [activeReceipt], input.fixture.db, () => cacheStartEpoch]);
		Reflect.set(offlineAuthorization, "activeReceipt", { before: beforeWindowReceipt, atStart: atWindowReceipt, admissionId: dueJob.admissionId, session: (await input.fixture.pool.query("SELECT desired_state,actual_state,control_mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0], admission: (await input.fixture.pool.query("SELECT state,occurrence_id,scheduled_end FROM runner_broadcast_admissions WHERE id=$1", [dueJob.admissionId])).rows[0] });

		await input.fixture.pool.query("UPDATE runner_destinations SET rtmp_url='rtmp://127.0.0.1:1952/changed',configuration_revision=configuration_revision+1 WHERE id=$1", [eventTargetId]);
		const refreshedActive = await schedules.issueRunnerScheduleCache({ id: input.runnerId, ownerId, token: deviceToken }, randomUUID(), input.fixture.db, () => cacheStartEpoch + 1);
		const capturedActiveJob = refreshedActive?.entries.find((entry) => entry.job.occurrenceId?.includes(cachedEvent.event.id))?.job;
		Reflect.set(offlineAuthorization, "activeRefresh", { oldAdmission: dueJob.admissionId, job: capturedActiveJob ? { admissionId: capturedActiveJob.admissionId, targetUrl: capturedActiveJob.destinations?.[0].rtmpUrl, occurrenceId: capturedActiveJob.occurrenceId, end: capturedActiveJob.scheduledEnd } : null, expectedEnd: dueJob.scheduledEnd });

		const invalidActionInputs = {
			deleteOwner: await schedules.deleteRunnerScheduleEventForPrincipal(principal, { ownerId: null }, input.fixture.db),
			deleteShape: await schedules.deleteRunnerScheduleEventForPrincipal(principal, { ownerId }, input.fixture.db),
			deleteMissing: await schedules.deleteRunnerScheduleEventForPrincipal(principal, { ownerId, runnerId: input.runnerId, id: randomUUID(), expectedRevision: 1 }, input.fixture.db),
			resumeShape: await schedules.resumeRunnerScheduleOccurrenceForPrincipal(principal, { ownerId }, input.fixture.db),
		};
		Reflect.set(offlineAuthorization, "invalidActions", invalidActionInputs);
		return { dueJob, activeReceipt };
	}
	const { dueJob, activeReceipt } = await observeActiveAuthority();

	async function observeFinishingRollback() {
		const { sql } = await import("drizzle-orm");
		const finishingRollback = new Error("ROLLBACK_FINISHING_OBSERVATION");
		try {
			await input.fixture.db.transaction(async (tx) => {
				await tx.execute(sql`UPDATE runner_broadcast_admissions SET state='authorized' WHERE id=${dueJob.admissionId}`);
				await tx.execute(sql`UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped' WHERE id=${sessionId}`);
				const finishing = { ...activeReceipt, state: "draining" as const };
				const actor = { id: input.runnerId, ownerId, token: deviceToken };
				const before = await acknowledgeFreeExecutions(actor, [finishing], tx, () => cacheStartEpoch - 1);
				const atEnd = await acknowledgeFreeExecutions(actor, [finishing], tx, () => dueJob.scheduledEnd!);
				const pending = (await tx.execute(sql`SELECT state,stopped_at FROM runner_broadcast_admissions WHERE id=${dueJob.admissionId}`)).rows[0];
				const visible = (await tx.execute(sql`SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=${sessionId}`)).rows[0];
				const repeated = await acknowledgeFreeExecutions(actor, [finishing], tx, () => dueJob.scheduledEnd! + 1);
				const repeatedSession = (await tx.execute(sql`SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=${sessionId}`)).rows[0];
				const terminal = await acknowledgeFreeExecutions(actor, [{ ...activeReceipt, state: "stopped", allOutputsClosed: true, playbackOutcome: "playback_timeout" }], tx, () => dueJob.scheduledEnd! + 60000);
				const closed = (await tx.execute(sql`SELECT state,terminal_reason,stopped_at FROM runner_broadcast_admissions WHERE id=${dueJob.admissionId}`)).rows[0];
				const finalSession = (await tx.execute(sql`SELECT desired_state,actual_state,last_error FROM stream_sessions WHERE id=${sessionId}`)).rows[0];
				Reflect.set(offlineAuthorization, "finishing", { admissionId: dueJob.admissionId, before, atEnd, pending, visible, repeated, repeatedSession, terminal, closed, finalSession });
				throw finishingRollback;
			});
		} catch (cause) {
			if (cause !== finishingRollback) throw cause;
		}
		return { sql };
	}
	const { sql } = await observeFinishingRollback();
	async function observeCacheInputDenials() {
		const previousError = (await input.fixture.pool.query("SELECT last_error FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].last_error;
		const timeoutMessage = "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit.";
		await input.fixture.pool.query("UPDATE stream_sessions SET last_error=$2 WHERE id=$1", [sessionId, timeoutMessage]);
		const timeoutView = (await input.actions.getStreamSessionsForRunner(input.runnerId, ownerId)).find((session) => session.id === sessionId);
		await input.fixture.pool.query("UPDATE stream_sessions SET last_error=NULL WHERE id=$1", [sessionId]);
		const healthyView = (await input.actions.getStreamSessionsForRunner(input.runnerId, ownerId)).find((session) => session.id === sessionId);
		await input.fixture.pool.query("UPDATE stream_sessions SET last_error=$2 WHERE id=$1", [sessionId, previousError]);
		Reflect.set(offlineAuthorization, "playbackViews", { timeout: timeoutView ? { hasError: timeoutView.hasError, playbackTimedOut: timeoutView.playbackTimedOut } : null, healthy: healthyView ? { hasError: healthyView.hasError, playbackTimedOut: healthyView.playbackTimedOut } : null, safe: timeoutView !== undefined && !JSON.stringify(timeoutView).includes(timeoutMessage) && !Object.keys(timeoutView).some((key) => /secret|streamkey|lasterror/i.test(key)) });
		const cacheInputDenials: { name: string; entries: number | null; unchanged: boolean }[] = [];
		for (const name of ["manual selection", "paused source", "missing captured source", "unreadable captured targets", "suppressed occurrence"]) {
			const rollbackInput = new Error("ROLLBACK_CACHE_INPUT_OBSERVATION");
			try {
				await input.fixture.db.transaction(async (tx) => {
					if (name === "manual selection") await tx.execute(sql`UPDATE stream_sessions SET control_mode='manual' WHERE id=${sessionId}`);
					if (name === "paused source") await tx.execute(sql`UPDATE overlays SET status='paused' WHERE id=${eventSourceId}`);
					if (name === "missing captured source") await tx.execute(sql`UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{sourceIdAtStart}',to_jsonb(${randomUUID()}::text)) WHERE id=${dueJob.admissionId}`);
					if (name === "unreadable captured targets") await tx.execute(sql`UPDATE runner_broadcast_admissions SET encrypted_targets_snapshot='invalid' WHERE id=${dueJob.admissionId}`);
					if (name === "suppressed occurrence") await tx.execute(sql`UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{scheduleSuppressed}','true'::jsonb) WHERE id=${dueJob.admissionId}`);
					const before = (await tx.execute(sql`SELECT count(*)::int AS count FROM runner_broadcast_admissions WHERE session_id=${sessionId}`)).rows[0].count;
					const cache = await Reflect.apply(schedules.issueRunnerScheduleCache, undefined, [{ id: input.runnerId, ownerId, token: deviceToken }, randomUUID(), tx, () => cacheStartEpoch + 1]);
					const after = (await tx.execute(sql`SELECT count(*)::int AS count FROM runner_broadcast_admissions WHERE session_id=${sessionId}`)).rows[0].count;
					cacheInputDenials.push({ name, entries: cache?.entries.length ?? null, unchanged: before === after });
					throw rollbackInput;
				});
			} catch (cause) {
				if (cause !== rollbackInput) throw cause;
			}
		}
		Reflect.set(offlineAuthorization, "inputDenials", cacheInputDenials);
	}
	await observeCacheInputDenials();

	async function observeScheduledStop() {
		const stopRevision = (await input.fixture.pool.query("SELECT configuration_revision FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].configuration_revision;
		const stopCurrentWithFuture = await controlStreamSession(principal, { creatorId: ownerId, sessionId, state: "stopped", expectedRevision: stopRevision });
		const afterScheduledStop = (await input.fixture.pool.query("SELECT state,benefits_at_start FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId])).rows;
		Reflect.set(offlineAuthorization, "scheduledStop", { accepted: stopCurrentWithFuture.accepted, future: afterScheduledStop.filter((row) => row.state === "authorized").map((row) => ({ suppressed: row.benefits_at_start.scheduleSuppressed === true })), current: afterScheduledStop.find((row) => row.state === "draining")?.benefits_at_start.scheduleSuppressed });
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active' WHERE id=$1", [dueJob.admissionId]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running' WHERE id=$1", [sessionId]);
	}
	await observeScheduledStop();

	async function observeRevocationRollback() {
		const { revokeDeviceAdmissions } = await import("@/server/runner/admission");
		let revocation: unknown;
		const rollbackRevocation = new Error("ROLLBACK_REVOCATION_OBSERVATION");
		try {
			await input.fixture.db.transaction(async (tx) => {
				await revokeDeviceAdmissions(tx, { id: input.runnerId, ownerId, token: deviceToken });
				const { runnerBroadcastAdmissionsTable } = await import("@/db/schema");
				const rows = await tx.select().from(runnerBroadcastAdmissionsTable);
				revocation = { success: true, rows: rows.filter((row) => row.sessionId === sessionId).map((row) => ({ id: row.id, state: row.state, revoked: row.revokedAt !== null, terminalCredential: row.terminalCredentialHash !== null })) };
				throw rollbackRevocation;
			});
		} catch (cause) {
			if (cause !== rollbackRevocation) {
				let current: unknown = cause;
				let knownConstraint = false;
				for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
					if (Reflect.get(current, "code") === "23505" && Reflect.get(current, "constraint") === "runner_admissions_open_session_unique") knownConstraint = true;
					current = Reflect.get(current, "cause");
				}
				if (!knownConstraint) throw cause;
				revocation = { success: false, constraint: "runner_admissions_open_session_unique" };
			}
		}
		Reflect.set(offlineAuthorization, "revocation", revocation);
	}
	await observeRevocationRollback();

	async function observeRecoveryRollback() {
		const { reserveBroadcastAdmission } = await import("@/server/runner/admission");
		const rollbackRecovery = new Error("ROLLBACK_CACHE_RECOVERY_OBSERVATION");
		let cacheRecovery: unknown;
		try {
			await input.fixture.db.transaction(async (tx) => {
				const { runnerBroadcastAdmissionsTable, streamSessionsTable } = await import("@/db/schema");
				const { and, eq } = await import("drizzle-orm");
				const [future] = await tx
					.select()
					.from(runnerBroadcastAdmissionsTable)
					.where(and(eq(runnerBroadcastAdmissionsTable.sessionId, sessionId), eq(runnerBroadcastAdmissionsTable.state, "authorized")))
					.limit(1);
				if (!future) throw new Error("FUTURE_RECOVERY_FIXTURE_MISSING");
				await tx
					.update(runnerBroadcastAdmissionsTable)
					.set({ leaseExpiresAt: new Date("2000-01-01T00:00:00Z"), scheduledEnd: new Date("2000-01-02T00:00:00Z") })
					.where(eq(runnerBroadcastAdmissionsTable.id, future.id));
				const [session] = await tx.select().from(streamSessionsTable).where(eq(streamSessionsTable.id, sessionId));
				await reserveBroadcastAdmission(tx, session, { proAccess: true, proSource: "pro" }, session.configurationRevision);
				const [recovered] = await tx.select().from(runnerBroadcastAdmissionsTable).where(eq(runnerBroadcastAdmissionsTable.id, future.id));
				const [retainedSession] = await tx.select().from(streamSessionsTable).where(eq(streamSessionsTable.id, sessionId));
				cacheRecovery = { state: recovered.state, reason: recovered.terminalReason, recovered: recovered.recoveredAt !== null, desired: retainedSession.desiredState, actual: retainedSession.actualState };
				throw rollbackRecovery;
			});
		} catch (cause) {
			if (cause !== rollbackRecovery) throw cause;
		}
		Reflect.set(offlineAuthorization, "recovery", cacheRecovery);
		return { reserveBroadcastAdmission };
	}
	const { reserveBroadcastAdmission } = await observeRecoveryRollback();

	async function observeUnknownOutputRollback() {
		const rollbackUnknown = new Error("ROLLBACK_CACHE_UNKNOWN_OUTPUT_OBSERVATION");
		let unknownCachedOutput: unknown;
		try {
			await input.fixture.db.transaction(async (tx) => {
				const { runnerBroadcastAdmissionsTable, streamSessionsTable } = await import("@/db/schema");
				const { and, eq } = await import("drizzle-orm");
				await tx.update(runnerBroadcastAdmissionsTable).set({ state: "stopped", stoppedAt: new Date() }).where(eq(runnerBroadcastAdmissionsTable.id, dueJob.admissionId));
				await tx
					.update(streamSessionsTable)
					.set({ desiredState: "stopped" as StreamState, actualState: "stopped" as StreamState, controlMode: "manual" })
					.where(eq(streamSessionsTable.id, sessionId));
				const [future] = await tx
					.select()
					.from(runnerBroadcastAdmissionsTable)
					.where(and(eq(runnerBroadcastAdmissionsTable.sessionId, sessionId), eq(runnerBroadcastAdmissionsTable.state, "authorized")))
					.limit(1);
				if (!future) throw new Error("UNKNOWN_CACHE_FIXTURE_MISSING");
				const [session] = await tx.select().from(streamSessionsTable).where(eq(streamSessionsTable.id, sessionId));
				unknownCachedOutput = await Reflect.apply(reserveBroadcastAdmission, undefined, [tx, session, { proAccess: true, proSource: "pro" }, session.configurationRevision + 1, undefined, () => Number(future.benefitsAtStart.scheduledStart)]);
				throw rollbackUnknown;
			});
		} catch (cause) {
			if (cause !== rollbackUnknown) throw cause;
		}
		Reflect.set(offlineAuthorization, "unknownOutput", unknownCachedOutput);
	}
	await observeUnknownOutputRollback();

	async function observeExpiredAuthoring() {
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',control_mode='scheduled' WHERE id=$1", [sessionId]);

		await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE session_id=$1", [sessionId]);
		await input.fixture.pool.query("DELETE FROM runner_schedule_events WHERE id=$1", [cachedEvent.event.id]);
		const expiredSubscription = randomUUID();
		await input.fixture.pool.query("INSERT INTO billing_subscriptions(id,user_id,stripe_customer_id,status,current_period_end,cancel_at_period_end) VALUES($1,$2,'isolated-schedule-billing','active',$3,true)", [expiredSubscription, ownerId, new Date(Date.now() - 1000)]);
		await input.fixture.pool.query("INSERT INTO billing_subscription_items(id,subscription_id,product_key,stripe_product_id,stripe_price_id,currency,billing_interval) VALUES($1,$2,'pro','isolated-pro','isolated-price','usd','month')", [randomUUID(), expiredSubscription]);
		const expiredView = await rows();
		const expiredWriteBefore = await persisted();
		const expiredWrite = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...base, title: "Expired paid edit" });
		const expiredWriteUnchanged = JSON.stringify(expiredWriteBefore) === JSON.stringify(await persisted());
		const expiredSnapshot = await readSnapshot(new Date());
		const expiredSigned = observeSigned(expiredSnapshot);
		const retainedPlan = (await input.fixture.pool.query("SELECT plan FROM users WHERE id=$1", [ownerId])).rows[0].plan;

		const legacyPaidDenied = await input.actions.upsertStreamSession({ ownerId, runnerId: input.runnerId, overlayId, mode: "24/7" as Parameters<typeof input.actions.upsertStreamSession>[0]["mode"], controlMode: "scheduled", rtmpUrl: "rtmp://127.0.0.1:1949/live", streamKey: "" });
		return { expiredView, expiredWrite, expiredWriteUnchanged, expiredSigned, retainedPlan, legacyPaidDenied };
	}
	const { expiredView, expiredWrite, expiredWriteUnchanged, expiredSigned, retainedPlan, legacyPaidDenied } = await observeExpiredAuthoring();

	return {
		offlineAuthorization,
		manualSourceCapture,
		eventTargetCapture,
		resumedCache,
		resumedExecution,
		stopObservations,
		resumedBeforeEnd,
		beforeEndState,
		resumedAtEnd,
		atEndUnchanged,
		resumedBeforeClosure,
		beforeClosureUnchanged,
		resumeEnd,
		resumeOccurrenceId,
		stoppedAdmission,
		beforeActivationEdit,
		exactActivationEdit,
		exactActivationEditUnchanged,
		exactActivationDelete,
		exactActivationDeleteUnchanged,
		authoringState,
		formCreate,
		formCreateJoins,
		metadataBefore: metadataCreated.event,
		pointerMetadataEdit,
		keyboardMetadataEdit,
		metadataJoins,
		keyboardResize,
		keyboardInvalidResize,
		keyboardInvalidResizeUnchanged,
		keyboardMove,
		keyboardMoveBefore: moveCreated.event,
		keyboardMoveJoins,
		activeDelete,
		activeDeleteUnchanged,
		staleDelete,
		staleDeleteUnchanged,
		deletedEvent,
		deletedRows,
		deletedJoins,
		deletionAudits,
		drainingEdit,
		drainingUnchanged,
		afterClosureEdit,
		activeEdits,
		authenticated: input.authenticated,
		saved: true,
		readAvailable: true,
		initial,
		initialView,
		vectors,
		vacation,
		activeCache,
		dst,
		identity,
		weekly,
		weekCache,
		spring,
		fall,
		midnight,
		midnightCache,
		overlap,
		overlapUnchanged,
		timezoneChange,
		newWeekCache,
		stale,
		staleUnchanged,
		rollback,
		rollbackUnchanged,
		raced,
		offsets,
		beforeMove,
		expiredView,
		retainedPlan,
		legacyPaidDenied,
		malformed,
		expected: { overlayId, sessionId, targetId, runnerId: input.runnerId },
		signedObserved,
		unsigned,
		missingDevice,
		expiredSigned,
		weeklyIdentity,
		scheduleReference,
		boundaryCases,
		emptyList,
		emptySnapshot,
		badRead,
		untrustedClock,
		disabled,
		disabledCache,
		boundedSigned,
		knownEnd: knownEnd.toISOString(),
		expiredWrite,
		expiredWriteUnchanged,
	};
}
