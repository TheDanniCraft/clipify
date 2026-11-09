import { eventPhase, eventScheduleSchema, canAcceptVotes } from "@/app/lib/events";

const schedule = { submissionsStart: "2026-01-01T00:00:00.000Z", submissionsEnd: "2026-02-01T00:00:00.000Z", votingStart: "2026-02-08T00:00:00.000Z", votingEnd: "2026-02-15T00:00:00.000Z", timezone: "Europe/Berlin", reviewRequired: true };

describe("Awards phase contract (FR-005, FR-016, EC-001, EC-006)", () => {
	it.each([
		["2025-12-31T23:59:59.999Z", "announcement"],
		[schedule.submissionsStart, "submissions"],
		[schedule.submissionsEnd, "review"],
		[schedule.votingStart, "voting"],
		[schedule.votingEnd, "closed"],
	])("uses the server boundary %s → %s", (now, phase) => {
		expect(eventPhase({ schedule, published: true, resultsPublished: false, reviewReleased: true }, new Date(now))).toBe(phase);
	});
	it("never opens a draft or reveals results based on time alone", () => {
		expect(eventPhase({ schedule, published: false, resultsPublished: false, reviewReleased: true }, new Date(schedule.votingStart))).toBe("draft");
		expect(eventPhase({ schedule, published: true, resultsPublished: true, reviewReleased: true }, new Date(schedule.votingEnd))).toBe("results");
	});
	it("holds reviewed voting until explicit release", () => {
		expect(eventPhase({ schedule, published: true, resultsPublished: false, reviewReleased: false }, new Date(schedule.votingStart))).toBe("review");
	});
	it("rejects a vote at close even from a stale page", () => {
		const state = { schedule, published: true, resultsPublished: false, reviewReleased: true };
		expect(canAcceptVotes(state, new Date(Date.parse(schedule.votingEnd) - 1))).toBe(true);
		expect(canAcceptVotes(state, new Date(schedule.votingEnd))).toBe(false);
	});
	it("allows adjacent phases without review", () => {
		expect(eventScheduleSchema.safeParse({ ...schedule, reviewRequired: false, votingStart: schedule.submissionsEnd }).success).toBe(true);
	});
	it.each([{ submissionsEnd: schedule.submissionsStart }, { votingStart: schedule.submissionsStart }, { votingEnd: schedule.votingStart }, { timezone: "Not/AZone" }, { submissionsStart: "not a date" }])("rejects invalid schedule %j", (changes) => {
		expect(eventScheduleSchema.safeParse({ ...schedule, ...changes }).success).toBe(false);
	});
});
