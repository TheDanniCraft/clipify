import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { runnerScheduleEventsTable, streamSessionsTable } from "@/db/schema";
import { resolveCalendarSchedule } from "./schedule-time";
import type { RunnerNextBroadcast } from "@/app/lib/runnerStandby";
/** Read-only; owner/Runner authorization is required at its calling boundary. */
export async function readRunnerNextBroadcastInternal(input: { ownerId: string; runnerId: string }, now = new Date(), client: QueryClient = db): Promise<RunnerNextBroadcast | null> {
	const nowMs = now.getTime();
	if (!Number.isFinite(nowMs)) return null;
	const sessions = await client.query.streamSessionsTable.findMany({ where: and(eq(streamSessionsTable.ownerId, input.ownerId), eq(streamSessionsTable.runnerId, input.runnerId)), columns: { id: true, controlMode: true, automationPausedAt: true } });
	const enabled = new Set(sessions.filter((session) => session.controlMode === "scheduled" && !session.automationPausedAt).map((session) => session.id));
	if (!enabled.size) return null;
	const events = await client.query.runnerScheduleEventsTable.findMany({ where: and(eq(runnerScheduleEventsTable.ownerId, input.ownerId), eq(runnerScheduleEventsTable.runnerId, input.runnerId), eq(runnerScheduleEventsTable.enabled, true)) });
	const candidates: RunnerNextBroadcast[] = [];
	for (const event of events) {
		if (!enabled.has(event.sessionId)) continue;
		try {
			const anchor = Date.parse(`${event.localStartDate}T00:00:00Z`);
			const start = event.recurrence === "once" ? nowMs : Math.max(nowMs, (Number.isFinite(anchor) ? anchor : nowMs) - 172800000);
			const end = event.recurrence === "once" ? "9999-12-31T23:59:59.999Z" : new Date(start + 1382400000).toISOString();
			const next = resolveCalendarSchedule(event, { start: new Date(start).toISOString(), end }).occurrences.find((occurrence) => Date.parse(occurrence.startUtc) > nowMs);
			if (next) candidates.push({ startUtc: next.startUtc, timezone: event.timezone });
		} catch {
			/* An invalid retained row cannot advertise a broadcast or break the remaining calendar. */
		}
	}
	return candidates.sort((left, right) => Date.parse(left.startUtc) - Date.parse(right.startUtc))[0] ?? null;
}
