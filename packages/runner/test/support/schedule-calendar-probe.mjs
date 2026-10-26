import { resolveCalendarSchedule } from "../../src/schedule-calendar.ts";
const repeated = process.argv.includes("--repeated");
const event = { id: "calendar-probe", configurationRevision: 1, timezone: "Europe/Berlin", recurrence: "weekly", localStartDate: repeated ? "2026-10-25" : "2026-03-22", localEndDate: null, localStartTime: "02:30", localEndTime: "03:30", weekdays: [7], endDayOffset: 0, recurrenceAnchor: repeated ? "2026-10-25" : "2026-03-22" };
const horizon = repeated ? { start: "2026-10-24T00:00:00Z", end: "2026-10-26T00:00:00Z" } : { start: "2026-03-28T00:00:00Z", end: "2026-04-06T00:00:00Z" };
console.log(JSON.stringify(resolveCalendarSchedule(event, horizon)));
