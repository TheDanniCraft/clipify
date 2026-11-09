import { eventInputSchema, categorySchema } from "@/app/lib/eventConfiguration";
const schedule = { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-08T00:00:00Z", votingEnd: "2026-02-15T00:00:00Z", timezone: "UTC", reviewRequired: true };
const base = { title: "Babbler Awards", description: "Community awards", visibility: "unlisted", schedule, votesPerCategory: 1, tiePolicy: "shared", resultDetail: "votes", whiteLabel: false, categories: [{ id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", title: "Fail", group: "Community", source: "clip", selection: "audience", submissionLimit: null, nomineeLimit: 6, rules: {}, options: [] }], slides: [] };
describe("Event configuration (FR-001/006)", () => {
	it("accepts unlimited submissions and the full schedule", () => expect(eventInputSchema.parse(base).categories[0].submissionLimit).toBeNull());
	it.each(["clip", "image", "video", "audio", "text", "link", "youtube", "person", "game"])("accepts source %s", (source) => expect(categorySchema.safeParse({ ...base.categories[0], source }).success).toBe(true));
	it("requires choices for a choice category", () => {
		expect(categorySchema.safeParse({ ...base.categories[0], source: "choice" }).success).toBe(false);
		expect(categorySchema.safeParse({ ...base.categories[0], source: "choice", options: ["Peach", "Lime"] }).success).toBe(true);
	});
	it.each([{ title: " " }, { votesPerCategory: 0 }, { votesPerCategory: 1.5 }, { categories: [] }, { unexpected: true }])("rejects invalid configuration %j", (change) => expect(eventInputSchema.safeParse({ ...base, ...change }).success).toBe(false));
	it("rejects reused category IDs", () => expect(eventInputSchema.safeParse({ ...base, categories: [base.categories[0], base.categories[0]] }).success).toBe(false));
	it("rejects inverted clip rule windows", () => expect(categorySchema.safeParse({ ...base.categories[0], rules: { startedAt: schedule.submissionsEnd, endedAt: schedule.submissionsStart } }).success).toBe(false));
});
