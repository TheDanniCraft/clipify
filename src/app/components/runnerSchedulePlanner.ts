import { fromDate, toCalendarDateTime, toZoned, type CalendarDate, type CalendarDateTime } from "@internationalized/date";
import { resolveCalendarSchedule, type CalendarSchedule } from "../../../packages/runner/src/schedule-calendar";

export type PlannerEvent = CalendarSchedule & { title: string; enabled: boolean; lockedUntil?: string | null };
export type PlannerSegment = { id: string; eventId: string; occurrenceId: string; title: string; isAllDay?: boolean; start: CalendarDateTime; end: CalendarDateTime; trueStartUtc: string; trueEndUtc: string; canResizeStart: boolean; canResizeEnd: boolean };
export function isAllDayWindow(event: Pick<CalendarSchedule, "localStartTime" | "localEndTime">) {
	return /^00:00(?::00)?$/.test(event.localStartTime) && /^00:00(?::00)?$/.test(event.localEndTime);
}
/** Agenda only indexes an event's starting day; each visual segment retains real bounds. */
export function projectScheduleViewport(events: readonly PlannerEvent[], start: CalendarDate, days: number, timezone: string): PlannerSegment[] {
	const horizonStart = toZoned(toCalendarDateTime(start), timezone).toDate().toISOString();
	const horizonEnd = toZoned(toCalendarDateTime(start.add({ days })), timezone)
		.toDate()
		.toISOString();
	const result: PlannerSegment[] = [];
	for (const event of events.filter((event) => event.enabled)) {
		const { occurrences } = resolveCalendarSchedule(event, { start: horizonStart, end: horizonEnd });
		for (const occurrence of occurrences) {
			if (isAllDayWindow(event)) {
				result.push({ id: JSON.stringify([occurrence.occurrenceId, "all-day"]), eventId: event.id, occurrenceId: occurrence.occurrenceId, title: event.title, isAllDay: true, start: toCalendarDateTime(fromDate(new Date(occurrence.startUtc), timezone)), end: toCalendarDateTime(fromDate(new Date(Date.parse(occurrence.endUtc) - 1), timezone)), trueStartUtc: occurrence.startUtc, trueEndUtc: occurrence.endUtc, canResizeStart: true, canResizeEnd: true });
				continue;
			}
			for (let offset = 0; offset < days; offset++) {
				const day = start.add({ days: offset });
				const dayStart = toZoned(toCalendarDateTime(day), timezone).toDate().getTime();
				const dayEnd = toZoned(toCalendarDateTime(day.add({ days: 1 })), timezone)
					.toDate()
					.getTime();
				const trueStart = Date.parse(occurrence.startUtc),
					trueEnd = Date.parse(occurrence.endUtc);
				const segmentStart = Math.max(dayStart, trueStart),
					segmentEnd = Math.min(dayEnd, trueEnd);
				if (segmentStart >= segmentEnd) continue;
				result.push({ id: JSON.stringify([occurrence.occurrenceId, day.toString()]), eventId: event.id, occurrenceId: occurrence.occurrenceId, title: event.title, start: toCalendarDateTime(fromDate(new Date(segmentStart), timezone)), end: toCalendarDateTime(fromDate(new Date(segmentEnd === dayEnd ? segmentEnd - 1 : segmentEnd), timezone)), trueStartUtc: occurrence.startUtc, trueEndUtc: occurrence.endUtc, canResizeStart: segmentStart === trueStart, canResizeEnd: segmentEnd === trueEnd });
			}
		}
	}
	return result;
}

export function plannerCreateWindow(start: CalendarDateTime, end: CalendarDateTime, timezone: string): { timezone: string; localStartDate: string; localEndDate: string; localStartTime: string; localEndTime: string } {
	return { timezone, localStartDate: start.toString().slice(0, 10), localEndDate: end.toString().slice(0, 10), localStartTime: start.toString().slice(11, 16), localEndTime: end.toString().slice(11, 16) };
}

/** Translate real boundaries, never the clipped visible segment's duration. */
export function plannerMoveWindow(segment: PlannerSegment, proposedStart: CalendarDateTime, timezone: string): ReturnType<typeof plannerCreateWindow> {
	const days = proposedStart.calendar.toJulianDay(proposedStart) - segment.start.calendar.toJulianDay(segment.start);
	const minutes = proposedStart.hour * 60 + proposedStart.minute - segment.start.hour * 60 - segment.start.minute;
	const start = toCalendarDateTime(fromDate(new Date(segment.trueStartUtc), timezone)).add({ days, minutes });
	const end = toCalendarDateTime(fromDate(new Date(segment.trueEndUtc), timezone)).add({ days, minutes });
	return plannerCreateWindow(start, end, timezone);
}

/** A clipped viewport edge is not an editable event boundary. */
export function plannerResizeWindow(segment: PlannerSegment, proposedEnd: CalendarDateTime, timezone: string): ReturnType<typeof plannerCreateWindow> | null {
	if (!segment.canResizeEnd || segment.end.millisecond !== 0) return null;
	const start = toCalendarDateTime(fromDate(new Date(segment.trueStartUtc), timezone));
	if (proposedEnd.compare(start) <= 0) return null;
	return plannerCreateWindow(start, proposedEnd, timezone);
}
