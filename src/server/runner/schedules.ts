import "server-only";
import { randomUUID, createHash, sign } from "node:crypto";
import { runnerSigningKey } from "./signing";
import { and, asc, desc, eq, gt, inArray, isNull, isNotNull, notInArray, or, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { parseDate, parseDateTime } from "@internationalized/date";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { db, type DatabaseClient, type QueryClient, type TransactionClient } from "@/db/client";
import { auditEventsTable, overlaysTable, runnersTable, runnerDestinationsTable, streamSessionsTable, runnerScheduleEventsTable, runnerScheduleEventDestinationsTable, runnerBroadcastAdmissionsTable, usersTable } from "@/db/schema";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { resourceFailure, isResourceFailure, toPublicResourceError } from "@/server/resources/errors";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "./capabilities";
import { resolveCalendarSchedule, type CalendarSchedule } from "./schedule-time";
import { captureSessionDestinations } from "./destinations";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
import { hashExecutionTargets, hashScheduledExecutionPayload } from "../../../packages/runner/src/protocol";
import type { FreeExecutionJob } from "../../../packages/runner/src/execution-runtime";

const ownerId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/);
const date = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		try {
			return parseDate(value).toString() === value;
		} catch {
			return false;
		}
	});
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);
const scheduleInput = z
	.object({
		ownerId,
		runnerId: z.uuid(),
		sessionId: z.uuid(),
		overlayId: z.uuid(),
		id: z.uuid().optional(),
		expectedRevision: z.number().int().positive().max(2_147_483_646).optional(),
		title: z.string().trim().min(1).max(80),
		timezone: z
			.string()
			.min(1)
			.max(128)
			.refine((value) => {
				try {
					new Intl.DateTimeFormat("en", { timeZone: value });
					return true;
				} catch {
					return false;
				}
			}),
		recurrence: z.enum(["once", "weekly"]),
		localStartDate: date,
		localEndDate: date.nullable().optional(),
		localStartTime: time,
		localEndTime: time,
		weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
		endDayOffset: z.number().int().min(0).max(7).default(0),
		destinationIds: z
			.array(z.uuid())
			.min(1)
			.refine((values) => new Set(values).size === values.length),
		enabled: z.boolean().default(true),
	})
	.strict()
	.superRefine((value, context) => {
		const issue = (message: string) => context.addIssue({ code: "custom", message });
		if (value.id && !value.expectedRevision) issue("Read the current event before editing it.");
		if (value.recurrence === "once") {
			if (!value.localEndDate) issue("Choose an end date.");
			else if (date.safeParse(value.localStartDate).success && date.safeParse(value.localEndDate).success && time.safeParse(value.localStartTime).success && time.safeParse(value.localEndTime).success && parseDateTime(`${value.localStartDate}T${value.localStartTime}`).compare(parseDateTime(`${value.localEndDate}T${value.localEndTime}`)) >= 0) issue("The schedule must end after it starts.");
		} else {
			if (!value.weekdays.length || new Set(value.weekdays).size !== value.weekdays.length) issue("Choose distinct start weekdays.");
			const minutes = (value: string) => {
				const parts = value.split(":").map(Number);
				return parts[0] * 60 + parts[1] + (parts[2] ?? 0) / 60;
			};
			const duration = value.endDayOffset * 1440 + minutes(value.localEndTime) - minutes(value.localStartTime);
			if (duration <= 0 || duration > 10080) issue("A weekly occurrence must end after its start and no later than its next weekly start.");
			const starts = value.weekdays.map((day) => (day - 1) * 1440 + minutes(value.localStartTime)).sort((a, b) => a - b);
			if (starts.some((start, index) => index > 0 && start < starts[index - 1] + duration) || (starts.length > 1 && starts[0] + 10080 < starts.at(-1)! + duration)) issue("Weekly occurrences cannot overlap each other.");
		}
	});
export type RunnerScheduleInput = z.input<typeof scheduleInput>;
type Event = typeof runnerScheduleEventsTable.$inferSelect;
export type RunnerScheduleView = Omit<Event, "ownerId" | "createdAt" | "updatedAt"> & { destinationIds: string[]; lockedUntil: string | null; lockReason: "active_window" | "output_drain" | null; currentOccurrence: { occurrenceId: string; endUtc: string; canResume: boolean; sessionRevision: number } | null };
type Failure = { success: false; code: string; error: string };
function failure(code: Parameters<typeof resourceFailure>[0], message?: string): Failure {
	const result = resourceFailure(code);
	return { success: false, code: result.error.code, error: message ?? result.error.message };
}
async function expectedFailures<T>(run: () => Promise<T>): Promise<T | Failure> {
	try {
		return await run();
	} catch (cause) {
		if (cause instanceof Error && (cause.message === "ACCESS_DENIED" || cause.message === "AUTHENTICATION_REQUIRED")) return failure("ACCESS_DENIED");
		const business = toPublicResourceError(cause);
		if (business.code !== "SERVICE_UNAVAILABLE") return failure(business.code, business.message);
		throw cause;
	}
}
async function readEvents(tx: TransactionClient, owner: string, runner: string) {
	const events = await tx
		.select()
		.from(runnerScheduleEventsTable)
		.where(and(eq(runnerScheduleEventsTable.ownerId, owner), eq(runnerScheduleEventsTable.runnerId, runner)))
		.orderBy(asc(runnerScheduleEventsTable.createdAt), asc(runnerScheduleEventsTable.id));
	const selections = events.length
		? await tx
				.select()
				.from(runnerScheduleEventDestinationsTable)
				.where(
					and(
						eq(runnerScheduleEventDestinationsTable.ownerId, owner),
						inArray(
							runnerScheduleEventDestinationsTable.eventId,
							events.map((row) => row.id),
						),
					),
				)
				.orderBy(asc(runnerScheduleEventDestinationsTable.position))
		: [];
	const captured = events.length ? await readCapturedScheduleLocks(tx, owner, runner) : new Map<string, string>();
	const sessions = events.length
		? await tx
				.select({ id: streamSessionsTable.id, revision: streamSessionsTable.configurationRevision, controlMode: streamSessionsTable.controlMode, desiredState: streamSessionsTable.desiredState })
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.ownerId, owner), eq(streamSessionsTable.runnerId, runner)))
		: [];
	const occupied = events.length
		? await tx
				.select({ sessionId: runnerBroadcastAdmissionsTable.sessionId })
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, owner), eq(runnerBroadcastAdmissionsTable.runnerId, runner), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
		: [];
	const busy = new Set(occupied.map((row) => row.sessionId));
	return events.map((row) =>
		eventView(
			row,
			selections.filter((item) => item.eventId === row.id).map((item) => item.destinationId),
			captured.get(row.id) ?? null,
			{ sessionRevision: sessions.find((session) => session.id === row.sessionId)?.revision ?? 0, canResume: sessions.some((session) => session.id === row.sessionId && session.controlMode === "scheduled" && session.desiredState === "stopped") && !busy.has(row.sessionId) },
		),
	);
}
/** Captured output ownership outlives the calendar end and heartbeat age. */
async function readCapturedScheduleLocks(tx: TransactionClient, owner: string, runner: string, now = new Date()) {
	const captures = await tx
		.select({ occurrenceId: runnerBroadcastAdmissionsTable.occurrenceId, scheduledEnd: runnerBroadcastAdmissionsTable.scheduledEnd })
		.from(runnerBroadcastAdmissionsTable)
		.where(
			and(
				eq(runnerBroadcastAdmissionsTable.ownerId, owner),
				eq(runnerBroadcastAdmissionsTable.runnerId, runner),
				isNotNull(runnerBroadcastAdmissionsTable.occurrenceId),
				or(ne(runnerBroadcastAdmissionsTable.state, "authorized"), sql`case when jsonb_typeof(${runnerBroadcastAdmissionsTable.benefitsAtStart}->'scheduledStart') = 'number' then (${runnerBroadcastAdmissionsTable.benefitsAtStart}->>'scheduledStart')::numeric else 0 end <= ${now.getTime()}`),
				or(inArray(runnerBroadcastAdmissionsTable.state, ["authorized", "reserved", "starting", "active", "draining", "uncertain"]), gt(runnerBroadcastAdmissionsTable.scheduledEnd, now)),
			),
		);
	const locks = new Map<string, string>();
	for (const capture of captures) {
		try {
			const identity: unknown = JSON.parse(capture.occurrenceId!);
			if (Array.isArray(identity) && identity.length === 2 && typeof identity[0] === "string" && typeof identity[1] === "string") locks.set(identity[0], capture.scheduledEnd?.toISOString() ?? new Date(0).toISOString());
		} catch {
			/* Older non-calendar identifiers cannot claim another event's identity. */
		}
	}
	return locks;
}

function currentScheduleOccurrence(event: Event, now = Date.now()) {
	if (!event.enabled) return null;
	const { occurrences } = resolveCalendarSchedule(event, { start: new Date(now).toISOString(), end: new Date(now + 1).toISOString() });
	return occurrences.find((occurrence) => Date.parse(occurrence.startUtc) <= now && Date.parse(occurrence.endUtc) > now) ?? null;
}
function activeScheduleWindowEnd(event: Event, now = Date.now()): string | null {
	return currentScheduleOccurrence(event, now)?.endUtc ?? null;
}
/** Caller already holds the shared owner/session mutation authority. */
export async function resolveActiveRunnerScheduleWindow(tx: TransactionClient, owner: string, runner: string, session: string, occurrenceId?: string, now = Date.now()) {
	const events = await tx
		.select()
		.from(runnerScheduleEventsTable)
		.where(and(eq(runnerScheduleEventsTable.ownerId, owner), eq(runnerScheduleEventsTable.runnerId, runner), eq(runnerScheduleEventsTable.sessionId, session), eq(runnerScheduleEventsTable.enabled, true)));
	const candidates = events.flatMap((event) => {
		const occurrence = currentScheduleOccurrence(event, now);
		return occurrence && (!occurrenceId || occurrence.occurrenceId === occurrenceId) ? [{ event, occurrence }] : [];
	});
	return candidates.length === 1 ? candidates[0] : null;
}

function eventView(row: Event, destinationIds: string[], capturedEnd: string | null = null, control?: { canResume: boolean; sessionRevision: number }): RunnerScheduleView {
	const occurrence = currentScheduleOccurrence(row);
	const lockedUntil = occurrence?.endUtc ?? capturedEnd;
	return {
		lockedUntil,
		currentOccurrence: occurrence ? { occurrenceId: occurrence.occurrenceId, endUtc: occurrence.endUtc, canResume: control?.canResume ?? false, sessionRevision: control?.sessionRevision ?? 0 } : null,
		lockReason: lockedUntil ? (Date.parse(lockedUntil) > Date.now() ? "active_window" : "output_drain") : null,
		id: row.id,
		runnerId: row.runnerId,
		sessionId: row.sessionId,
		overlayId: row.overlayId,
		title: row.title,
		timezone: row.timezone,
		recurrence: row.recurrence,
		recurrenceAnchor: row.recurrenceAnchor,
		weekdayAnchors: row.weekdayAnchors,
		localStartDate: row.localStartDate,
		localEndDate: row.localEndDate,
		weekdays: row.weekdays,
		localStartTime: row.localStartTime,
		localEndTime: row.localEndTime,
		endDayOffset: row.endDayOffset,
		enabled: row.enabled,
		configurationRevision: row.configurationRevision,
		destinationIds,
	};
}
function reconcileWeekdayAnchors(current: Event | undefined, days: number[]) {
	const existing = current?.weekdayAnchors ?? [];
	const removed = existing.filter((slot) => !days.includes(slot.weekday));
	return [...days].sort((a, b) => a - b).map((weekday) => ({ weekday, anchor: existing.find((slot) => slot.weekday === weekday)?.anchor ?? removed.shift()?.anchor ?? randomUUID() }));
}
function overlaps(left: CalendarSchedule, right: CalendarSchedule) {
	// A once interval is checked across its true dates, including a future weekly series start.
	const startFor = (event: CalendarSchedule) => Date.parse(event.localStartDate + "T00:00:00Z");
	let start = Math.max(startFor(left), startFor(right)) - 8 * 86400000;
	if (left.recurrence === "once" && right.recurrence === "once") start = Math.min(startFor(left), startFor(right)) - 86400000;
	const end = Math.max(start + 400 * 86400000, ...[left, right].filter((row) => row.recurrence === "once").map((row) => Date.parse(row.localEndDate + "T00:00:00Z") + 86400000));
	const range = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
	const first = resolveCalendarSchedule(left, range).occurrences,
		second = resolveCalendarSchedule(right, range).occurrences;
	return first.some((a) => second.some((b) => Date.parse(a.startUtc) < Date.parse(b.endUtc) && Date.parse(b.startUtc) < Date.parse(a.endUtc)));
}

/** Owner/member/benefit locks serialize revisions and same-Runner overlap decisions. */
export async function saveRunnerScheduleEventForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db, clock: () => number = Date.now) {
	const owner = ownerId.safeParse(typeof rawInput === "object" && rawInput !== null ? Reflect.get(rawInput, "ownerId") : undefined);
	if (!owner.success) return failure("INVALID_INPUT");
	return expectedFailures(() =>
		client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, owner.data, "runner:update", tx);
			const parsed = scheduleInput.safeParse(rawInput);
			if (!parsed.success) return failure("INVALID_INPUT", parsed.error.issues[0]?.message);
			const input = parsed.data;
			const policy = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx));
			if (!policy.scheduling) return failure("FEATURE_RESTRICTED");
			const current = input.id
				? (
						await tx
							.select()
							.from(runnerScheduleEventsTable)
							.where(and(eq(runnerScheduleEventsTable.ownerId, input.ownerId), eq(runnerScheduleEventsTable.id, input.id)))
							.limit(1)
							.for("update")
					)[0]
				: undefined;
			if (input.id && !current) return failure("RESOURCE_UNAVAILABLE");
			if (current && current.configurationRevision !== input.expectedRevision) return failure("CONFLICT");
			if (current && (activeScheduleWindowEnd(current, clock()) || (await readCapturedScheduleLocks(tx, current.ownerId, current.runnerId, new Date(clock()))).has(current.id))) return failure("ACTIVE_OCCURRENCE_LOCKED");
			const [runner] = await tx
				.select({ id: runnersTable.id })
				.from(runnersTable)
				.where(and(eq(runnersTable.ownerId, input.ownerId), eq(runnersTable.id, input.runnerId)))
				.limit(1);
			const [session] = await tx
				.select()
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.ownerId, input.ownerId), eq(streamSessionsTable.id, input.sessionId), eq(streamSessionsTable.runnerId, input.runnerId)))
				.limit(1);
			const [overlay] = await tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.ownerId, input.ownerId), eq(overlaysTable.id, input.overlayId)))
				.limit(1);
			if (!runner || !session || session.mode !== "24/7" || !overlay) return failure("INVALID_INPUT", "Choose an owned clip-playback source and Runner broadcast.");
			const targets = await tx
				.select({ id: runnerDestinationsTable.id })
				.from(runnerDestinationsTable)
				.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), inArray(runnerDestinationsTable.id, input.destinationIds), or(eq(runnerDestinationsTable.runnerId, input.runnerId), isNull(runnerDestinationsTable.runnerId))));
			if (targets.length !== input.destinationIds.length) return failure("INVALID_INPUT", "Choose destinations belonging to this creator and Runner.");
			const values = {
				ownerId: input.ownerId,
				runnerId: input.runnerId,
				sessionId: input.sessionId,
				overlayId: input.overlayId,
				title: input.title,
				timezone: input.timezone,
				recurrence: input.recurrence,
				recurrenceAnchor: current?.recurrenceAnchor ?? input.localStartDate,
				weekdayAnchors: input.recurrence === "weekly" ? reconcileWeekdayAnchors(current, input.weekdays) : [],
				localStartDate: input.localStartDate,
				localEndDate: input.recurrence === "once" ? input.localEndDate! : null,
				localStartTime: input.localStartTime,
				localEndTime: input.localEndTime,
				weekdays: input.recurrence === "weekly" ? [...input.weekdays].sort((a, b) => a - b) : [],
				endDayOffset: input.recurrence === "weekly" ? input.endDayOffset : 0,
				enabled: input.enabled,
				configurationRevision: (current?.configurationRevision ?? 0) + 1,
				updatedAt: new Date(),
			};
			const candidate = { ...values, id: current?.id ?? randomUUID() };
			const peers = await readEvents(tx, input.ownerId, input.runnerId);
			if (candidate.enabled && peers.some((row) => row.id !== candidate.id && row.enabled && overlaps(candidate, row))) return failure("INVALID_INPUT", "This schedule overlaps another event on this Runner.");
			authority.assertAuthorityCurrent();
			const [saved] = current ? await tx.update(runnerScheduleEventsTable).set(values).where(eq(runnerScheduleEventsTable.id, current.id)).returning() : await tx.insert(runnerScheduleEventsTable).values(candidate).returning();
			if (current) await tx.delete(runnerScheduleEventDestinationsTable).where(and(eq(runnerScheduleEventDestinationsTable.ownerId, input.ownerId), eq(runnerScheduleEventDestinationsTable.eventId, saved.id)));
			await tx.insert(runnerScheduleEventDestinationsTable).values(input.destinationIds.map((destinationId, position) => ({ eventId: saved.id, ownerId: input.ownerId, destinationId, position })));
			await tx.insert(auditEventsTable).values({ actorUserId: principal.authUserId, ...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}), targetType: "runner_schedule_event", targetId: saved.id, action: "runner.schedule.save", outcome: "success", correlationId: randomUUID(), occurredAt: new Date() });
			return { success: true as const, event: eventView(saved, input.destinationIds) };
		}),
	);
}
type AutomationSession = Pick<typeof streamSessionsTable.$inferSelect, "id" | "configurationRevision" | "automationRevision" | "automationPausedAt" | "controlMode" | "desiredState" | "actualState">;
function automationView(session: AutomationSession) {
	return { sessionId: session.id, configurationRevision: session.configurationRevision, automationRevision: session.automationRevision, pausedAt: session.automationPausedAt?.toISOString() ?? null, controlMode: session.controlMode, desiredState: session.desiredState, actualState: session.actualState };
}
async function readAutomationControls(tx: TransactionClient, owner: string, runner: string) {
	const rows = await tx
		.select({ id: streamSessionsTable.id, configurationRevision: streamSessionsTable.configurationRevision, automationRevision: streamSessionsTable.automationRevision, automationPausedAt: streamSessionsTable.automationPausedAt, controlMode: streamSessionsTable.controlMode, desiredState: streamSessionsTable.desiredState, actualState: streamSessionsTable.actualState })
		.from(streamSessionsTable)
		.where(and(eq(streamSessionsTable.ownerId, owner), eq(streamSessionsTable.runnerId, runner)))
		.orderBy(asc(streamSessionsTable.id));
	return rows.map(automationView);
}
const automationInput = z.object({ ownerId, runnerId: z.uuid(), sessionId: z.uuid(), expectedRevision: z.number().int().positive(), expectedAutomationRevision: z.number().int().nonnegative(), paused: z.boolean() }).strict();
/** Pause changes automation authority, never captured media configuration or mode. */
export async function setRunnerAutomationPausedForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: QueryClient = db, clock: () => number = Date.now) {
	const owner = ownerId.safeParse(typeof rawInput === "object" && rawInput !== null ? Reflect.get(rawInput, "ownerId") : undefined);
	if (!owner.success) return failure("INVALID_INPUT");
	return expectedFailures(() =>
		client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, owner.data, "runner:update", tx);
			const parsed = automationInput.safeParse(rawInput);
			if (!parsed.success) return failure("INVALID_INPUT");
			const input = parsed.data;
			const [device] = await tx
				.select({ id: runnersTable.id })
				.from(runnersTable)
				.where(and(eq(runnersTable.ownerId, input.ownerId), eq(runnersTable.id, input.runnerId)))
				.limit(1)
				.for("update");
			if (!device) return failure("RESOURCE_UNAVAILABLE");
			const [session] = await tx
				.select()
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.ownerId, input.ownerId), eq(streamSessionsTable.runnerId, input.runnerId), eq(streamSessionsTable.id, input.sessionId)))
				.limit(1)
				.for("update");
			if (!session) return failure("RESOURCE_UNAVAILABLE");
			if (session.configurationRevision !== input.expectedRevision || session.automationRevision !== input.expectedAutomationRevision) return failure("CONFLICT");
			if (session.controlMode !== "scheduled" || session.mode !== "24/7") return failure("INVALID_INPUT", "Automation controls require Scheduled clip playback.");
			const now = new Date(clock());
			if (!input.paused && !deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx, now), now).scheduling) return failure("FEATURE_RESTRICTED");
			authority.assertAuthorityCurrent();
			if ((session.automationPausedAt !== null) === input.paused) return { success: true as const, automation: automationView(session) };
			const [updated] = await tx
				.update(streamSessionsTable)
				.set({ automationPausedAt: input.paused ? now : null, automationRevision: session.automationRevision + 1, updatedAt: now })
				.where(eq(streamSessionsTable.id, session.id))
				.returning();
			await tx
				.update(runnersTable)
				.set({ configurationRevision: sql`${runnersTable.configurationRevision} + 1` })
				.where(eq(runnersTable.id, device.id));
			await tx.insert(auditEventsTable).values({ actorUserId: principal.authUserId, ...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}), targetType: "stream_session", targetId: session.id, action: input.paused ? "runner.automation.pause" : "runner.automation.resume", outcome: "success", correlationId: randomUUID(), occurredAt: now });
			return { success: true as const, automation: automationView(updated) };
		}),
	);
}

const readInput = z.object({ ownerId, runnerId: z.uuid() }).strict();
export async function listRunnerScheduleEventsForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = readInput.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	return expectedFailures(() =>
		client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, parsed.data.ownerId, "runner:read", tx);
			const events = await readEvents(tx, parsed.data.ownerId, parsed.data.runnerId);
			const policy = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx));
			authority.assertAuthorityCurrent();
			return { success: true as const, events, policy, automation: await readAutomationControls(tx, parsed.data.ownerId, parsed.data.runnerId) };
		}),
	);
}
/** Trusted clock is an internal argument; public action inputs cannot choose policy time. */
export async function getRunnerScheduleSnapshotForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, now = new Date(), client: DatabaseClient = db) {
	const parsed = readInput.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	return expectedFailures(() =>
		client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, parsed.data.ownerId, "runner:read", tx);
			const policy = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx, now), now);
			const [device] = await tx
				.select({ id: runnersTable.id, configurationRevision: runnersTable.configurationRevision })
				.from(runnersTable)
				.where(and(eq(runnersTable.ownerId, parsed.data.ownerId), eq(runnersTable.id, parsed.data.runnerId)))
				.limit(1);
			if (!device) return failure("RESOURCE_UNAVAILABLE");

			const snapshot = await buildRunnerScheduleMetadata(tx, parsed.data.ownerId, device, policy, now);
			authority.assertAuthorityCurrent();
			return snapshot;
		}),
	);
}

async function buildRunnerScheduleMetadata(tx: TransactionClient, owner: string, device: { id: string; configurationRevision: number }, policy: ReturnType<typeof deriveRunnerCapabilities>, now: Date) {
	const events = await readEvents(tx, owner, device.id);
	const automation = await readAutomationControls(tx, owner, device.id);
	const horizon = { start: now.toISOString(), end: new Date(now.getTime() + 604800000).toISOString() };

	const expanded = events.filter((event) => event.enabled && !automation.find((control) => control.sessionId === event.sessionId)?.pausedAt).map((event) => resolveCalendarSchedule(event, horizon));
	const sources = events.length
		? await tx
				.select({ id: overlaysTable.id, revision: overlaysTable.configurationRevision })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.ownerId, owner), inArray(overlaysTable.id, [...new Set(events.map((row) => row.overlayId))])))
				.orderBy(asc(overlaysTable.id))
		: [];
	const selectedIds = [...new Set(events.flatMap((row) => row.destinationIds))];
	const targetVersions = selectedIds.length
		? await tx
				.select({ id: runnerDestinationsTable.id, configurationRevision: runnerDestinationsTable.configurationRevision, credentialRevision: runnerDestinationsTable.credentialRevision })
				.from(runnerDestinationsTable)
				.where(and(eq(runnerDestinationsTable.ownerId, owner), inArray(runnerDestinationsTable.id, selectedIds)))
				.orderBy(asc(runnerDestinationsTable.id))
		: [];
	const occurrenceIds = expanded.flatMap((row) => row.occurrences.map((occurrence) => occurrence.occurrenceId));
	const captured = occurrenceIds.length
		? await tx
				.select({ occurrenceId: runnerBroadcastAdmissionsTable.occurrenceId, revision: runnerBroadcastAdmissionsTable.configurationRevision, benefits: runnerBroadcastAdmissionsTable.benefitsAtStart, reason: runnerBroadcastAdmissionsTable.terminalReason })
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, owner), eq(runnerBroadcastAdmissionsTable.runnerId, device.id), inArray(runnerBroadcastAdmissionsTable.occurrenceId, occurrenceIds)))
				.orderBy(desc(runnerBroadcastAdmissionsTable.configurationRevision))
		: [];
	const executionIntents = new Map<string, { executionRevision: number; suppressed: boolean }>();
	for (const capture of captured) {
		if (capture.occurrenceId && !executionIntents.has(capture.occurrenceId)) executionIntents.set(capture.occurrenceId, { executionRevision: capture.revision, suppressed: capture.benefits.scheduleSuppressed === true || capture.reason === "manual_stop" });
	}
	const occurrences = expanded
		.flatMap((row) => row.occurrences)
		.flatMap((occurrence) => {
			const event = events.find((row) => row.id === occurrence.eventId)!;
			const source = sources.find((row) => row.id === event.overlayId);
			const targets = event.destinationIds.map((id) => targetVersions.find((row) => row.id === id));
			if (!source || !targets.length || targets.some((row) => !row)) return [];
			return [{ ...occurrence, ...(executionIntents.get(occurrence.occurrenceId) ?? { executionRevision: 0, suppressed: false }), sessionId: event.sessionId, overlayId: event.overlayId, sourceRevision: source.revision, destinationIds: event.destinationIds, targetVersions: targets }];
		});
	const skipped = expanded.flatMap((row) => row.skipped);
	const snapshotRevision = createHash("sha256")
		.update(JSON.stringify({ events, automation: automation.map(({ sessionId, automationRevision, pausedAt }) => ({ sessionId, automationRevision, pausedAt })), sources, targetVersions, executionIntents: [...executionIntents], capabilityRevision: policy.capabilityRevision }))
		.digest("hex");
	const issuedAt = now.getTime(),
		expiresAt = policy.runnerPro && policy.validUntil ? Math.min(issuedAt + 604800000, Date.parse(policy.validUntil)) : issuedAt + 604800000;
	const claims = { issuer: "clipify.us", kind: "schedule", version: 1, ownerId: owner, runnerId: device.id, configurationRevision: device.configurationRevision, snapshotRevision, issuedAt, expiresAt, capabilities: policy, occurrences: policy.scheduling ? occurrences : [], skipped };
	let bundle: { keyId: string; payload: string; signature: string } | null = null;
	if (process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY) {
		const { key, keyId } = runnerSigningKey();
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		bundle = { keyId, payload, signature: sign(null, Buffer.from(payload), key).toString("base64url") };
	}
	return { success: true as const, ownerId: owner, runnerId: device.id, horizon, policy, occurrences, skipped, bundle };
}

/** Delete only an editable owned event; joins and success audit share its transaction. */
export async function deleteRunnerScheduleEventForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db, clock: () => number = Date.now) {
	const owner = ownerId.safeParse(typeof rawInput === "object" && rawInput !== null ? Reflect.get(rawInput, "ownerId") : undefined);
	if (!owner.success) return failure("INVALID_INPUT");
	return expectedFailures(() =>
		client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, owner.data, "runner:update", tx);
			const parsed = z
				.object({ ownerId, runnerId: z.uuid(), id: z.uuid(), expectedRevision: z.number().int().positive().max(2_147_483_646) })
				.strict()
				.safeParse(rawInput);
			if (!parsed.success) return failure("INVALID_INPUT");
			const input = parsed.data;
			const policy = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx));
			if (!policy.scheduling) return failure("FEATURE_RESTRICTED");
			const [event] = await tx
				.select()
				.from(runnerScheduleEventsTable)
				.where(and(eq(runnerScheduleEventsTable.ownerId, input.ownerId), eq(runnerScheduleEventsTable.runnerId, input.runnerId), eq(runnerScheduleEventsTable.id, input.id)))
				.limit(1)
				.for("update");
			if (!event) return failure("RESOURCE_UNAVAILABLE");
			if (event.configurationRevision !== input.expectedRevision) return failure("CONFLICT");
			if (activeScheduleWindowEnd(event, clock()) || (await readCapturedScheduleLocks(tx, event.ownerId, event.runnerId, new Date(clock()))).has(event.id)) return failure("ACTIVE_OCCURRENCE_LOCKED");
			authority.assertAuthorityCurrent();
			await tx.delete(runnerScheduleEventsTable).where(and(eq(runnerScheduleEventsTable.ownerId, input.ownerId), eq(runnerScheduleEventsTable.id, event.id)));
			await tx.insert(auditEventsTable).values({ actorUserId: principal.authUserId, ...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}), targetType: "runner_schedule_event", targetId: event.id, action: "runner.schedule.delete", outcome: "success", correlationId: randomUUID(), occurredAt: new Date() });
			authority.assertAuthorityCurrent();
			return { success: true as const, id: event.id };
		}),
	);
}

export async function resumeRunnerScheduleOccurrenceForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db, clock: () => number = Date.now) {
	const parsed = z
		.object({ ownerId, sessionId: z.uuid(), occurrenceId: z.string().min(1).max(512), expectedRevision: z.number().int().positive().max(2_147_483_646) })
		.strict()
		.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	return expectedFailures(async () => {
		const { controlStreamSession } = await import("@/server/resources/runners");
		const input = parsed.data;
		const result = await controlStreamSession(principal, { creatorId: input.ownerId, sessionId: input.sessionId, state: "running", expectedRevision: input.expectedRevision, occurrenceId: input.occurrenceId }, client, clock);
		if (isResourceFailure(result)) return { success: false as const, code: result.error.code, error: result.error.message };
		return { success: true as const, accepted: result.accepted, applied: result.applied, admissionId: result.admissionId, configurationRevision: result.configurationRevision };
	});
}

/** Assigned devices receive execution authority only under fresh owner/device locks.
 * Future authorizations occupy authority without claiming that physical output is active.
 */
export async function issueRunnerScheduleCache(runner: Pick<typeof runnersTable.$inferSelect, "id" | "ownerId" | "token">, requestId: string, client: DatabaseClient = db, clock: () => number = Date.now) {
	if (!process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY || !z.uuid().safeParse(requestId).success) return null;
	return client.transaction(async (tx) => {
		const [owner] = await tx.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, runner.ownerId)).limit(1).for("update");
		if (!owner) return null;
		const [device] = await tx
			.select()
			.from(runnersTable)
			.where(and(eq(runnersTable.id, runner.id), eq(runnersTable.ownerId, owner.id)))
			.limit(1)
			.for("update");
		if (!device || device.token !== runner.token || device.protocolVersion !== 2 || !device.capabilities.includes("schedule_cache")) return null;
		const now = new Date(clock());
		const policy = deriveRunnerCapabilities(await resolveRunnerBenefits(owner, tx, now), now);
		const snapshot = await buildRunnerScheduleMetadata(tx, owner.id, device, policy, now);
		const issuedAt = now.getTime(),
			expiresAt = policy.runnerPro && policy.validUntil ? Math.min(issuedAt + 604800000, Date.parse(policy.validUntil)) : issuedAt + 604800000;
		const { key, keyId } = runnerSigningKey();
		const signed = (claims: object) => {
			const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
			return { keyId, payload, signature: sign(null, Buffer.from(payload), key).toString("base64url") };
		};
		const entries: { job: FreeExecutionJob }[] = [];
		for (const occurrence of policy.scheduling ? snapshot.occurrences : []) {
			if (occurrence.suppressed || Date.parse(occurrence.startUtc) >= expiresAt || Date.parse(occurrence.endUtc) <= issuedAt) continue;
			const [session] = await tx
				.select()
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.id, occurrence.sessionId), eq(streamSessionsTable.ownerId, owner.id), eq(streamSessionsTable.runnerId, device.id)))
				.limit(1)
				.for("update");
			if (!session || session.controlMode !== "scheduled" || session.mode !== "24/7" || session.automationPausedAt !== null) continue;
			const openAdmissions = await tx
				.select()
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, owner.id), eq(runnerBroadcastAdmissionsTable.runnerId, device.id), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
				.for("update");
			if (openAdmissions.some((row) => !["reserved", "starting", "active"].includes(row.state) || row.revokedAt || row.benefitsAtStart.scheduleSuppressed === true)) continue;
			const { decryptString } = await import("@/app/lib/encryption");
			// Future rights must not replace an unavailable accepted capture.
			// Validate that capture independently from each future event's source.
			let currentCaptureAvailable = true;
			for (const current of openAdmissions) {
				const sourceId = current.benefitsAtStart.sourceIdAtStart;
				const [retainedSource] =
					typeof sourceId === "string"
						? await tx
								.select({ id: overlaysTable.id, status: overlaysTable.status })
								.from(overlaysTable)
								.where(and(eq(overlaysTable.id, sourceId), eq(overlaysTable.ownerId, owner.id)))
								.limit(1)
								.for("share")
						: [];
				const plaintext = current.encryptedTargetsSnapshot ? decryptString(current.encryptedTargetsSnapshot) : null;
				let readableTargets = false;
				if (plaintext) {
					try {
						const captured = JSON.parse(plaintext);
						readableTargets = captured.version === 1 && Array.isArray(captured.destinations) && captured.destinations.length > 0;
					} catch {
						/* Invalid retained snapshot cannot authorize a replacement. */
					}
				}
				if (!retainedSource || retainedSource.status !== "active" || !readableTargets || !(await resolveRetainedResourceAccess({ kind: "overlay", ownerId: owner.id, resourceId: retainedSource.id, client: tx })).runtime) {
					currentCaptureAvailable = false;
					break;
				}
			}
			if (!currentCaptureAvailable) continue;
			const physical = openAdmissions.find((row) => row.occurrenceId === occurrence.occurrenceId);
			const capturedSourceId = typeof physical?.benefitsAtStart.sourceIdAtStart === "string" ? physical.benefitsAtStart.sourceIdAtStart : occurrence.overlayId;

			const [source] = await tx
				.select()
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, capturedSourceId), eq(overlaysTable.ownerId, owner.id)))
				.limit(1)
				.for("share");
			if (!source || source.status !== "active" || !(await resolveRetainedResourceAccess({ kind: "overlay", ownerId: owner.id, resourceId: source.id, client: tx })).runtime) continue;
			const captured = physical ? (physical.encryptedTargetsSnapshot ? { encryptedTargetsSnapshot: physical.encryptedTargetsSnapshot, targetIdsSnapshot: physical.targetIdsSnapshot } : resourceFailure("RESOURCE_UNAVAILABLE")) : await captureSessionDestinations(tx, session, true, occurrence.eventId);
			if (isResourceFailure(captured)) continue;
			const plaintext = captured.encryptedTargetsSnapshot ? decryptString(captured.encryptedTargetsSnapshot) : null;
			if (!plaintext) continue;
			const destinations: NonNullable<FreeExecutionJob["destinations"]> = JSON.parse(plaintext).destinations;
			const targetHash = hashExecutionTargets(destinations);
			const sourceRevision = typeof physical?.benefitsAtStart.sourceRevisionAtStart === "number" ? physical.benefitsAtStart.sourceRevisionAtStart : source.configurationRevision;
			const privateJob = { overlayId: source.id, overlaySecret: source.secret, mode: "24/7" as const, fps: session.fps, resolution: session.resolution, targetHash };
			const executionPayloadHash = hashScheduledExecutionPayload(privateJob);
			const cacheConfigurationHash = createHash("sha256")
				.update(JSON.stringify({ eventRevision: occurrence.configurationRevision, sourceRevision, executionPayloadHash }))
				.digest("hex");
			const previous = await tx
				.select()
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, owner.id), eq(runnerBroadcastAdmissionsTable.runnerId, device.id), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), eq(runnerBroadcastAdmissionsTable.occurrenceId, occurrence.occurrenceId), eq(runnerBroadcastAdmissionsTable.state, "authorized"), isNull(runnerBroadcastAdmissionsTable.revokedAt)))
				.for("update");
			let admission = physical ?? previous.find((row) => row.benefitsAtStart.cacheConfigurationHash === cacheConfigurationHash);
			if (!admission) {
				[admission] = await tx
					.insert(runnerBroadcastAdmissionsTable)
					.values({
						ownerId: owner.id,
						runnerId: device.id,
						sessionId: session.id,
						executionGeneration: randomUUID(),
						occurrenceId: occurrence.occurrenceId,
						state: "authorized",
						configurationRevision: session.configurationRevision,
						...captured,
						scheduledEnd: new Date(occurrence.endUtc),
						leaseId: randomUUID(),
						leaseExpiresAt: new Date(expiresAt),
						protocolSupportsLease: true,
						dispatchedAt: now,
						benefitsAtStart: { ...policy, ingestModeAtStart: "24/7", scheduleEventId: occurrence.eventId, scheduleEventRevision: occurrence.configurationRevision, scheduledStart: Date.parse(occurrence.startUtc), sourceIdAtStart: source.id, sourceRevisionAtStart: source.configurationRevision, cacheConfigurationHash, executionPayloadHashAtStart: executionPayloadHash, cacheAuthorization: true },
					})
					.returning();
			} else {
				[admission] = await tx
					.update(runnerBroadcastAdmissionsTable)
					.set({ leaseId: admission.leaseId ?? randomUUID(), leaseExpiresAt: new Date(expiresAt), protocolSupportsLease: true, dispatchedAt: admission.dispatchedAt ?? now, state: admission.state === "reserved" ? "starting" : admission.state, benefitsAtStart: { ...admission.benefitsAtStart, executionPayloadHashAtStart: executionPayloadHash } })
					.where(eq(runnerBroadcastAdmissionsTable.id, admission.id))
					.returning();
			}
			const claims = {
				issuer: "clipify.us",
				kind: "scheduled_execution",
				policy: "pro_broadcast",
				cacheAuthorization: true as const,
				ownerId: owner.id,
				runnerId: device.id,
				sessionId: session.id,
				admissionId: admission.id,
				generation: admission.executionGeneration,
				leaseId: admission.leaseId,
				requestId,
				configurationRevision: admission.configurationRevision,
				sourceId: source.id,
				sourceRevision,
				targetHash,
				executionPayloadHash,
				occurrenceId: occurrence.occurrenceId,
				scheduledStart: typeof admission.benefitsAtStart.scheduledStart === "number" ? admission.benefitsAtStart.scheduledStart : Date.parse(occurrence.startUtc),
				scheduledEnd: admission.scheduledEnd?.getTime() ?? Date.parse(occurrence.endUtc),
				issuedAt,
				expiresAt,
			};
			entries.push({
				job: {
					...privateJob,
					id: session.id,
					ownerId: owner.id,
					runnerId: device.id,
					admissionId: admission.id,
					executionGeneration: admission.executionGeneration,
					configurationRevision: admission.configurationRevision,
					sourceRevision,
					rtmpUrl: destinations[0].rtmpUrl,
					streamKey: destinations[0].streamKey,
					destinations,
					desiredState: "running",
					cacheAuthorization: true,
					occurrenceId: occurrence.occurrenceId,
					scheduledStart: claims.scheduledStart,
					scheduledEnd: claims.scheduledEnd,
					lease: signed(claims),
				},
			});
		}
		const bundle = signed({ issuer: "clipify.us", kind: "schedule_cache", version: 1, ownerId: owner.id, runnerId: device.id, requestId, configurationRevision: device.configurationRevision, issuedAt, expiresAt, capabilities: policy, entries: entries.map(({ job }) => ({ admissionId: job.admissionId, occurrenceId: job.occurrenceId, authorizationHash: createHash("sha256").update(job.lease.payload).digest("hex") })) });
		return { bundle, entries };
	});
}
