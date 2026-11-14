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

it("keeps data-award slide positions stable for the presenter while withholding unfinished results", () => {
	const view = projectAwardEvent(event as never, candidates as never, [], true, new Date("2026-02-10"));
	expect(view.categories.map((category) => category.id)).toEqual(["category", "data"]);
	expect(view.categories[1]).not.toHaveProperty("dataResult");
	expect(JSON.stringify(view)).not.toContain("Secret winner");
});

it.each(["winner", "percentages"] as const)("honors the creator's %s public result detail without leaking vote counts", (detail) => {
	const view = projectAwardEvent({ ...event, configuration: { ...event.configuration, resultDetail: detail }, resultsPublishedAt: new Date("2026-02-16") } as never, candidates as never, [{ candidateId: "one", votes: 12 }], false, new Date("2026-02-16"));
	const result = view.categories[0].results![0];
	expect(result).toMatchObject({ id: "one", winner: true });
	expect(result).not.toHaveProperty("votes");
	if (detail === "winner") expect(result).not.toHaveProperty("percentage");
	else expect(result).toHaveProperty("percentage", 100);
});

it("uses the frozen top nominees and includes the winner within the configured total", () => {
	const content = (reference: string, views: number) => ({ kind: "clip" as const, reference, title: reference, description: "", creatorId: "host", views });
	const winner = content("winner", 100),
		second = content("second", 50),
		third = content("third", 20);
	const data = { ...event, configuration: { ...event.configuration, categories: [{ ...category, selection: "data" as const, presenterMode: "nominees" as const, dataNomineeSource: "top" as const, nomineeLimit: 2 }] }, frozenResults: { [category.id]: { status: "ready", source: "clips", title: winner.title, description: "", content: winner, nominees: [winner, second, third], asOf: "2026-02-01T00:00:00Z" } } };
	const projected = projectAwardEvent(data as never, [], [], true, new Date("2026-02-16"));
	expect(projected.categories[0].candidates.map(({ content }) => content.reference)).toEqual(["winner", "second"]);
	expect(projected.categories[0].results).toBeUndefined();
});

it("allows a two-view team nominee and unlimited selections without replacing the data winner", () => {
	const content = (reference: string, views: number) => ({ kind: "clip" as const, reference, title: reference, description: "", creatorId: "host", views });
	const winner = content("winner", 100);
	const data = { ...event, configuration: { ...event.configuration, categories: [{ ...category, selection: "data" as const, presenterMode: "nominees" as const, dataNomineeSource: "team" as const, nomineeLimit: null }] }, frozenResults: { [category.id]: { status: "ready", source: "clips", title: winner.title, description: "", content: winner, asOf: "2026-02-01T00:00:00Z" } } };
	const choices = ["a", "b", "c", "d", "e"].map((id) => ({ id, categoryId: category.id, content: content(id, 2), nominated: true, parentId: null }));
	const projected = projectAwardEvent(data as never, choices, [], true, new Date("2026-02-16"));
	expect(projected.categories[0].candidates).toHaveLength(6);
	expect(projected.categories[0].candidates[0].content).toMatchObject({ reference: "winner", views: 100 });
	expect(projected.categories[0].candidates[1].content.views).toBe(2);
});

it("keeps data candidate identities stable when text team rows return in a different order", () => {
	const make = (id: string, title: string) => ({ id, categoryId: category.id, content: { kind: "text" as const, reference: "", title, description: "" }, nominated: true, parentId: null });
	const rows = [make("first", "One"), make("second", "Two")];
	const data = { ...event, configuration: { ...event.configuration, categories: [{ ...category, selection: "data" as const, presenterMode: "nominees" as const, dataNomineeSource: "team" as const, nomineeLimit: null }] }, frozenResults: { [category.id]: { status: "ready", source: "manual", title: "0", description: "", asOf: "2026-02-01T00:00:00Z" } } };
	const before = projectAwardEvent(data as never, rows, [], true, new Date("2026-02-16T00:00:00Z")).categories[0].candidates;
	const after = projectAwardEvent(data as never, [...rows].reverse(), [], true, new Date("2026-02-16T00:00:00Z")).categories[0].candidates;
	expect(new Set(before.map((c) => c.id)).size).toBe(3);
	expect(Object.fromEntries(after.map((c) => [c.content.title, c.id]))).toEqual(Object.fromEntries(before.map((c) => [c.content.title, c.id])));
});
