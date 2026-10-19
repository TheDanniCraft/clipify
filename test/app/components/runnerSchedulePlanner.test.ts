import { parseDate, parseDateTime } from "@internationalized/date";
import { projectScheduleViewport, plannerCreateWindow, plannerMoveWindow, plannerResizeWindow, type PlannerEvent } from "@/app/components/runnerSchedulePlanner";

const vacation: PlannerEvent = { id: "vacation", title: "Vacation broadcast", enabled: true, configurationRevision: 1, timezone: "Europe/Berlin", recurrence: "once", recurrenceAnchor: "original-window", localStartDate: "2027-01-03", localEndDate: "2027-01-13", localStartTime: "18:00", localEndTime: "20:00", weekdays: [], endDayOffset: 0 };
test("TDD-US3-DEC009 U191: a clipped week projects every day without replacing true bounds or logical identity", () => {
	const segments = projectScheduleViewport([vacation], parseDate("2027-01-04"), 7, "Europe/Berlin");
	expect(segments).toHaveLength(7);
	expect(new Set(segments.map((s) => s.id)).size).toBe(7);
	expect(new Set(segments.map((s) => s.occurrenceId)).size).toBe(1);
	expect(segments.every((s) => s.eventId === vacation.id && s.trueStartUtc === "2027-01-03T17:00:00.000Z" && s.trueEndUtc === "2027-01-13T19:00:00.000Z")).toBe(true);
	expect(segments.map((s) => s.start.toString())).toEqual(Array.from({ length: 7 }, (_, i) => `2027-01-${String(i + 4).padStart(2, "0")}T00:00:00`));
	expect(segments.every((s) => !s.canResizeStart && !s.canResizeEnd)).toBe(true);
});

test("TDD-US3-FR010 U10: an Agenda creation carries explicit local dates and eighteen-to-twenty boundaries into the editor", () => {
	expect(plannerCreateWindow(parseDateTime("2027-01-04T18:00"), parseDateTime("2027-01-04T20:00"), "UTC")).toEqual({ timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "18:00", localEndTime: "20:00" });
});

test("TDD-US3-OPT022 U62: moving a visible interval preserves its full duration and leaves the saved segment untouched", () => {
	const segment = projectScheduleViewport([{ ...vacation, timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "13:00" }], parseDate("2027-01-04"), 1, "UTC")[0];
	const before = JSON.stringify(segment);
	expect(plannerMoveWindow(segment, parseDateTime("2027-01-04T13:00"), "UTC")).toEqual({ timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "13:00", localEndTime: "14:00" });
	expect(JSON.stringify(segment)).toBe(before);
});
test("TDD-US3-DEC009: moving a middle-day visual segment translates the true multi-week interval", () => {
	const segment = projectScheduleViewport([vacation], parseDate("2027-01-06"), 1, "Europe/Berlin")[0];
	expect(plannerMoveWindow(segment, parseDateTime("2027-01-07T02:00"), "Europe/Berlin")).toEqual({ timezone: "Europe/Berlin", localStartDate: "2027-01-04", localEndDate: "2027-01-14", localStartTime: "20:00", localEndTime: "22:00" });
});

test("TDD-US3-OPT024 U64: resizing changes only the real end boundary", () => {
	const segment = projectScheduleViewport([{ ...vacation, timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "13:00" }], parseDate("2027-01-04"), 1, "UTC")[0];
	expect(plannerResizeWindow(segment, parseDateTime("2027-01-04T14:00"), "UTC")).toEqual({ timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "14:00" });
});
test("TDD-US3-DEC009: resizing the final day preserves the original multi-week start", () => {
	const segment = projectScheduleViewport([vacation], parseDate("2027-01-13"), 1, "Europe/Berlin")[0];
	expect(plannerResizeWindow(segment, parseDateTime("2027-01-13T21:00"), "Europe/Berlin")).toEqual({ timezone: "Europe/Berlin", localStartDate: "2027-01-03", localEndDate: "2027-01-13", localStartTime: "18:00", localEndTime: "21:00" });
});
test("TDD-US3-DEC009: a clipped middle-day boundary cannot be mistaken for the actual event end", () => {
	const segment = projectScheduleViewport([vacation], parseDate("2027-01-06"), 1, "Europe/Berlin")[0];
	expect(plannerResizeWindow(segment, parseDateTime("2027-01-06T21:00"), "Europe/Berlin")).toBeNull();
});

test("TDD-US3-DEC009 baseline: disabled events never produce interactive calendar segments", () => {
	expect(projectScheduleViewport([{ ...vacation, enabled: false }], parseDate("2027-01-04"), 7, "Europe/Berlin")).toEqual([]);
});
test("TDD-US3-DEC009 baseline: nonintersecting days never produce phantom segments around a short event", () => {
	const segments = projectScheduleViewport([{ ...vacation, timezone: "UTC", localStartDate: "2027-01-06", localEndDate: "2027-01-06", localStartTime: "12:00", localEndTime: "13:00" }], parseDate("2027-01-04"), 7, "UTC");
	expect(segments).toHaveLength(1);
	expect(segments[0].start.toString()).toBe("2027-01-06T12:00:00");
	expect(segments[0].end.toString()).toBe("2027-01-06T13:00:00");
});
test.each(["2027-01-04T12:00", "2027-01-04T11:59"])("TDD-US3-OPT024 baseline: an end at or before the true start %s cannot become an editor draft", (end) => {
	const segment = projectScheduleViewport([{ ...vacation, timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "13:00" }], parseDate("2027-01-04"), 1, "UTC")[0];
	const before = JSON.stringify(segment);
	expect(plannerResizeWindow(segment, parseDateTime(end), "UTC")).toBeNull();
	expect(JSON.stringify(segment)).toBe(before);
});
test("TDD-US3-DEC009 baseline: the display-only last millisecond never replaces an actual midnight end", () => {
	const segment = projectScheduleViewport([{ ...vacation, timezone: "UTC", localStartDate: "2027-01-04", localEndDate: "2027-01-05", localStartTime: "12:00", localEndTime: "00:00" }], parseDate("2027-01-04"), 1, "UTC")[0];
	expect(segment.canResizeEnd).toBe(true);
	expect(segment.end.millisecond).toBe(999);
	expect(segment.trueEndUtc).toBe("2027-01-05T00:00:00.000Z");
	expect(plannerResizeWindow(segment, parseDateTime("2027-01-04T23:00"), "UTC")).toBeNull();
});

test.each([
	["2027-03-28", "2027-03-29", 23],
	["2027-10-31", "2027-11-01", 25],
])("full calendar day %s stays one all-day bar across DST", (localStartDate, localEndDate, hours) => {
	const rows = projectScheduleViewport([{ ...vacation, localStartDate, localEndDate, localStartTime: "00:00", localEndTime: "00:00" }], parseDate(localStartDate), 1, "Europe/Berlin");
	expect(rows).toHaveLength(1);
	expect(rows[0].isAllDay).toBe(true);
	expect(Date.parse(rows[0].trueEndUtc) - Date.parse(rows[0].trueStartUtc)).toBe(Number(hours) * 3600000);
	expect(rows[0].end.toString()).toBe(`${localStartDate}T23:59:59.999`);
});
test("a multi-day all-day broadcast spans once rather than filling each time column", () => {
	const rows = projectScheduleViewport([{ ...vacation, localStartDate: "2027-01-04", localEndDate: "2027-01-07", localStartTime: "00:00", localEndTime: "00:00" }], parseDate("2027-01-04"), 7, "Europe/Berlin");
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ isAllDay: true, eventId: vacation.id });
	expect(rows[0].end.toString()).toBe("2027-01-06T23:59:59.999");
});

test("a window offset from midnight by seconds remains timed", () => {
	const rows = projectScheduleViewport([{ ...vacation, localStartDate: "2027-01-04", localEndDate: "2027-01-05", localStartTime: "00:00:30", localEndTime: "00:00:30" }], parseDate("2027-01-04"), 7, "Europe/Berlin");
	expect(rows).toHaveLength(2);
	expect(rows.every((row) => !row.isAllDay)).toBe(true);
});
