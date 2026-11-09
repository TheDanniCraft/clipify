import { projectAwardEvent } from "@/app/lib/eventPublicView";
const category = { id: "category", title: "Fail", group: "Community", source: "text", selection: "audience", rules: {}, options: [], submissionLimit: 1, nomineeLimit: 6 };
const event = {
	id: "event",
	ownerId: "host",
	presenterDigest: "secret-hash",
	configuration: { title: "Awards", description: "", categories: [category, { ...category, id: "data", selection: "data", manualResult: { title: "Secret winner" } }], schedule: { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-08T00:00:00Z", votingEnd: "2026-02-15T00:00:00Z", timezone: "UTC", reviewRequired: true }, votesPerCategory: 1, tiePolicy: "shared", resultDetail: "votes", whiteLabel: false, visibility: "unlisted", slides: [] },
	publishedAt: new Date("2025-12-01"),
	resultsPublishedAt: null,
	reviewReleased: true,
	frozenResults: { data: { title: "Secret winner" } },
	frozenAt: new Date("2026-02-01"),
};
const candidates = [
	{ id: "one", categoryId: "category", content: { kind: "text", title: "Lampe", description: "", reference: "" }, nominated: true, parentId: null, canonicalKey: "private" },
	{ id: "child", categoryId: "category", content: { kind: "text", title: "original", description: "", reference: "" }, nominated: false, parentId: "one", canonicalKey: "private" },
];
it("conceals hidden results, data categories, group children and capability material", () => {
	const result = projectAwardEvent(event as never, candidates as never, [{ candidateId: "one", votes: 12 }], false, new Date("2026-02-10"));
	expect(result.categories).toHaveLength(1);
	expect(result.categories[0].candidates).toHaveLength(1);
	expect(JSON.stringify(result)).not.toMatch(/Secret winner|secret-hash|private|original|"votes":12/);
	expect(result.categories[0]).not.toHaveProperty("results");
});
it("reveals results only to presenter or after explicit publication", () => {
	const now = new Date("2026-02-16");
	expect(projectAwardEvent(event as never, candidates as never, [{ candidateId: "one", votes: 12 }], false, now).categories).toHaveLength(1);
	const presenter = projectAwardEvent(event as never, candidates as never, [{ candidateId: "one", votes: 12 }], true, now);
	expect(presenter.categories).toHaveLength(2);
	expect(presenter.categories[0].results?.[0]).toMatchObject({ votes: 12, winner: true });
	const archive = projectAwardEvent({ ...event, resultsPublishedAt: now } as never, candidates as never, [{ candidateId: "one", votes: 12 }], false, now);
	expect(archive.phase).toBe("results");
	expect(archive.categories).toHaveLength(2);
});

it("does not substitute unfrozen category settings for a historical result", () => {
	const view = projectAwardEvent({ ...event, frozenResults: null } as never, candidates as never, [], true, new Date("2026-02-16"));
	expect(view.categories.find((category) => category.id === "data")?.dataResult).toBeNull();
});
