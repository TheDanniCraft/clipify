/** @jest-environment node */
const mockSessions = jest.fn();
const mockEvents = jest.fn();
jest.mock("@/db/client", () => ({ db: { query: { streamSessionsTable: { findMany: (...args: unknown[]) => mockSessions(...args) }, runnerScheduleEventsTable: { findMany: (...args: unknown[]) => mockEvents(...args) } } } }));
import { readRunnerNextBroadcastInternal } from "@/server/runner/standby-next-broadcast";
import { PgDialect } from "drizzle-orm/pg-core";
const input = { ownerId: "next-owner", runnerId: "11111111-1111-4111-8111-111111111111" };
const event = { id: "22222222-2222-4222-8222-222222222222", configurationRevision: 1, sessionId: "eligible", timezone: "Europe/Berlin", recurrence: "once", localStartDate: "2028-01-15", localEndDate: "2028-01-15", localStartTime: "14:00", localEndTime: "16:00", recurrenceAnchor: "2028-01-15", weekdays: [], endDayOffset: 0, enabled: true };
beforeEach(() => {
	jest.clearAllMocks();
	mockSessions.mockResolvedValue([{ id: "eligible", controlMode: "scheduled", automationPausedAt: null }]);
	mockEvents.mockResolvedValue([event]);
});

test("TDD-US4-OPT063 U103 strength: next standby time resolves beyond the cache horizon using owner-scoped enabled schedules", async () => {
	expect(await readRunnerNextBroadcastInternal(input, new Date("2027-01-01T00:00:00Z"))).toEqual({ startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" });
	const dialect = new PgDialect();
	expect(dialect.sqlToQuery(mockSessions.mock.calls[0][0].where).params).toEqual([input.ownerId, input.runnerId]);
	expect(dialect.sqlToQuery(mockEvents.mock.calls[0][0].where).params).toEqual([input.ownerId, input.runnerId, true]);
});

test("TDD-US4-OPT063 U103 strength: earliest eligible start wins while paused, manual and corrupt rows cannot advertise output", async () => {
	mockSessions.mockResolvedValue([
		{ id: "eligible", controlMode: "scheduled", automationPausedAt: null },
		{ id: "manual", controlMode: "manual", automationPausedAt: null },
		{ id: "paused", controlMode: "scheduled", automationPausedAt: new Date() },
	]);
	mockEvents.mockResolvedValue([{ ...event, sessionId: "manual", localStartDate: "2028-01-02", localEndDate: "2028-01-02" }, { ...event, sessionId: "paused", localStartDate: "2028-01-03", localEndDate: "2028-01-03" }, { ...event, recurrence: "weekly", localStartDate: "invalid", localEndDate: null, weekdays: [1] }, event, { ...event, id: "33333333-3333-4333-8333-333333333333", timezone: "UTC", localStartDate: "2028-01-14", localEndDate: "2028-01-14" }]);
	expect(await readRunnerNextBroadcastInternal(input, new Date("2027-01-01T00:00:00Z"))).toEqual({ startUtc: "2028-01-14T14:00:00.000Z", timezone: "UTC" });
});

test("TDD-US4-OPT063 U103 strength: a future weekly anchor beyond seven days retains its first configured start", async () => {
	mockEvents.mockResolvedValue([{ ...event, recurrence: "weekly", timezone: "UTC", localStartDate: "2027-01-04", localEndDate: null, recurrenceAnchor: "2027-01-04", weekdays: [1], localStartTime: "12:00", localEndTime: "13:00" }]);
	expect(await readRunnerNextBroadcastInternal(input, new Date("2026-12-01T00:00:00Z"))).toEqual({ startUtc: "2027-01-04T12:00:00.000Z", timezone: "UTC" });
});

test("TDD-US4-OPT063 U103 strength: weekly next-start selection uses the first repeated Berlin autumn instant", async () => {
	mockEvents.mockResolvedValue([{ ...event, recurrence: "weekly", localStartDate: "2026-03-22", localEndDate: null, recurrenceAnchor: "2026-03-22", weekdays: [7], localStartTime: "02:30", localEndTime: "03:30" }]);
	expect(await readRunnerNextBroadcastInternal(input, new Date("2026-10-20T12:00:00Z"))).toEqual({ startUtc: "2026-10-25T00:30:00.000Z", timezone: "Europe/Berlin" });
});

test("TDD-US4-OPT063 U103 strength: the current occurrence is not advertised as the next broadcast", async () => {
	expect(await readRunnerNextBroadcastInternal(input, new Date("2028-01-15T14:00:00Z"))).toBeNull();
});

test("TDD-US4-OPT063 U103 strength: no eligible schedules yields no hint with the normal default clock", async () => {
	mockSessions.mockResolvedValue([]);
	expect(await readRunnerNextBroadcastInternal(input)).toBeNull();
	expect(mockEvents).not.toHaveBeenCalled();
});

test("TDD-US4-OPT063 U103 strength: an invalid clock cannot query or advertise a broadcast", async () => {
	expect(await readRunnerNextBroadcastInternal(input, new Date("invalid"))).toBeNull();
	expect(mockSessions).not.toHaveBeenCalled();
	expect(mockEvents).not.toHaveBeenCalled();
});
