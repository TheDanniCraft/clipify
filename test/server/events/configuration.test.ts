import { createAwardConfiguration } from "@/app/lib/eventDefaults";
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

it("accepts an explicitly selected storage connection and rejects an invalid ID", () => {
	const storageConnectionId = "4455a7b3-993d-4cf6-b9d3-52a9c03a0ba2";
	expect(eventInputSchema.safeParse({ ...base, storageConnectionId }).success).toBe(true);
	expect(eventInputSchema.safeParse({ ...base, storageConnectionId: "other" }).success).toBe(false);
});

it("normalizes presenter chat filters while retaining configurable command prefixes", () => {
	const input = createAwardConfiguration("Awards", "UTC");
	input.presentation = { showChat: true, hiddenAccounts: ["NightBot", "@SomeBot", ""], commandPrefixes: ["!", "/", "?"] };
	const parsed = eventInputSchema.safeParse(input);
	expect(parsed.success).toBe(true);
	if (parsed.success) expect(parsed.data.presentation).toEqual({ showChat: true, hiddenAccounts: ["nightbot", "somebot"], commandPrefixes: ["!", "/", "?"] });
});

it("retains legacy category defaults and accepts nominee sources and unlimited limits", () => {
	const input = createAwardConfiguration("Awards", "UTC");
	expect(eventInputSchema.parse(input).categories[0].presenterMode).toBeUndefined();
	input.categories[0] = { ...input.categories[0], selection: "data", presenterMode: "nominees", dataNomineeSource: "team", nomineeLimit: null };
	expect(eventInputSchema.parse(input).categories[0]).toMatchObject({ nomineeLimit: null, dataNomineeSource: "team" });
});
it.each([14, 61])("rejects Twitch duration %s outside the supported window", (duration) => {
	const input = createAwardConfiguration("Awards", "UTC");
	input.slides = [{ id: crypto.randomUUID(), type: "category", categoryId: input.categories[0].id, title: "", text: "", statistics: [], interaction: { type: "poll", wait: true, duration } }];
	expect(eventInputSchema.safeParse(input).success).toBe(false);
});
it("rejects interactions on winner-only or non-category slides", () => {
	const input = createAwardConfiguration("Awards", "UTC");
	const slide = { id: crypto.randomUUID(), type: "category" as const, categoryId: input.categories[0].id, title: "", text: "", statistics: [], presenterMode: "winner" as const, interaction: { type: "poll" as const, wait: true, duration: 60 } };
	expect(eventInputSchema.safeParse({ ...input, slides: [slide] }).success).toBe(false);
	expect(eventInputSchema.safeParse({ ...input, slides: [{ ...slide, type: "welcome", presenterMode: undefined }] }).success).toBe(false);
});

it.each([
	["poll", 1, false],
	["poll", 2, true],
	["poll", 5, true],
	["poll", 6, false],
	["prediction", 1, false],
	["prediction", 2, true],
	["prediction", 10, true],
	["prediction", 11, false],
] as const)("checks every Twitch %s option boundary at %s", async (type, count, expected) => {
	const { eventInteractionFits } = await import("@/app/lib/eventInteractions");
	expect(eventInteractionFits(type, count)).toBe(expected);
});
