import { parseDate, parseDateTime, toZoned, fromDate, toCalendarDate, getDayOfWeek, type CalendarDate } from "@internationalized/date";

export type CalendarSchedule = {
	id: string;
	configurationRevision: number;
	timezone: string;
	recurrence: "once" | "weekly";
	localStartDate: string | null;
	localEndDate: string | null;
	localStartTime: string;
	localEndTime: string;
	weekdays: number[];
	endDayOffset: number;
	recurrenceAnchor: string;
	weekdayAnchors?: { weekday: number; anchor: string }[];
};
export type CalendarOccurrence = { eventId: string; occurrenceId: string; recurrenceAnchor: string; configurationRevision: number; startUtc: string; endUtc: string };
export type SkippedCalendarOccurrence = { eventId: string; recurrenceAnchor: string; reason: string; message: string };

/** Resolve wall-clock boundaries explicitly; skip gaps and choose the first repeated instant. */
export function resolveCalendarSchedule(event: CalendarSchedule, horizon: { start: string; end: string }): { occurrences: CalendarOccurrence[]; skipped: SkippedCalendarOccurrence[] } {
	const occurrences: CalendarOccurrence[] = [],
		skipped: SkippedCalendarOccurrence[] = [];
	const horizonStart = Date.parse(horizon.start),
		horizonEnd = Date.parse(horizon.end);
	if (!Number.isFinite(horizonStart) || !Number.isFinite(horizonEnd) || horizonEnd <= horizonStart) return { occurrences, skipped };
	const addWindow = (startDate: CalendarDate, endDate: CalendarDate, anchor: string) => {
		const localStart = parseDateTime(`${startDate}T${event.localStartTime}`),
			localEnd = parseDateTime(`${endDate}T${event.localEndTime}`);
		const start = toZoned(localStart, event.timezone, "earlier"),
			end = toZoned(localEnd, event.timezone, "earlier");
		const sameWall = (left: typeof localStart, right: typeof start) => left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
		if (!sameWall(localStart, start) || !sameWall(localEnd, end)) {
			skipped.push({ eventId: event.id, recurrenceAnchor: anchor, reason: "DST_GAP", message: "A scheduled boundary does not exist because of the local clock change. This occurrence is skipped." });
			return;
		}
		const startMs = start.toDate().getTime(),
			endMs = end.toDate().getTime();
		if (endMs <= startMs) {
			skipped.push({ eventId: event.id, recurrenceAnchor: anchor, reason: "INVALID_WINDOW", message: "The schedule must end after it starts." });
			return;
		}
		if (startMs >= horizonEnd || endMs <= horizonStart) return;
		occurrences.push({ eventId: event.id, occurrenceId: scheduleOccurrenceKey({ eventId: event.id, recurrenceAnchor: anchor, configurationRevision: event.configurationRevision }), recurrenceAnchor: anchor, configurationRevision: event.configurationRevision, startUtc: new Date(startMs).toISOString(), endUtc: new Date(endMs).toISOString() });
	};
	if (event.recurrence === "once") {
		if (event.localStartDate && event.localEndDate) addWindow(parseDate(event.localStartDate), parseDate(event.localEndDate), event.recurrenceAnchor);
	} else {
		const localHorizonStart = toCalendarDate(fromDate(new Date(horizonStart), event.timezone)),
			localHorizonEnd = toCalendarDate(fromDate(new Date(horizonEnd), event.timezone));
		const firstDate = parseDate(event.localStartDate ?? event.recurrenceAnchor);
		const originalDate = /^\d{4}-\d{2}-\d{2}$/.test(event.recurrenceAnchor) ? parseDate(event.recurrenceAnchor) : firstDate;
		const firstWeek = originalDate.subtract({ days: getDayOfWeek(originalDate, "en-GB") });
		const weekdays = [...new Set(event.weekdays)].sort((left, right) => left - right);
		for (let date = localHorizonStart.subtract({ days: 7 }); date.compare(localHorizonEnd) <= 0; date = date.add({ days: 1 })) {
			if (date.compare(firstDate) < 0) continue;
			const weekday = getDayOfWeek(date, "en-GB") + 1,
				index = weekdays.indexOf(weekday);
			if (index < 0) continue;
			const week = Math.floor((date.calendar.toJulianDay(date) - firstWeek.calendar.toJulianDay(firstWeek)) / 7);
			addWindow(date, date.add({ days: event.endDayOffset }), `${event.recurrenceAnchor}:${week}:${event.weekdayAnchors?.find((slot) => slot.weekday === weekday)?.anchor ?? weekday}`);
		}
	}
	return { occurrences: occurrences.sort((left, right) => Date.parse(left.startUtc) - Date.parse(right.startUtc)), skipped };
}

/** Configuration revisions cannot reset a logical occurrence or its suppression key. */
export function scheduleOccurrenceKey(input: { eventId: string; recurrenceAnchor: string; configurationRevision: number }): string {
	return JSON.stringify([input.eventId, input.recurrenceAnchor]);
}
