import { candidateInputSchema, canonicalCandidateKey, candidateMatchesRules, visibleCandidates, votingResults } from "@/app/lib/eventCandidates";
const clip = { kind: "clip" as const, reference: "ARealClip", title: "Lampe raucht ab", description: "", thumbnailUrl: "https://clips-media-assets2.twitch.tv/example.jpg", createdAt: "2026-03-01T12:00:00Z", views: 20, duration: 30, creatorId: "host" };
describe("Award candidate rules and results", () => {
	it("deduplicates known source IDs but not independent text submissions", () => {
		expect(canonicalCandidateKey(clip, "one")).toBe(canonicalCandidateKey(clip, "two"));
		expect(canonicalCandidateKey({ ...clip, kind: "text" }, "one")).not.toBe(canonicalCandidateKey({ ...clip, kind: "text" }, "two"));
	});
	it("requires host identity and applies inclusive start/exclusive end and title rules", () => {
		const rules = { startedAt: clip.createdAt, endedAt: "2027-01-01T00:00:00Z", minViews: 20, titleIncludes: "LAMPE", titleExcludes: "spoiler" };
		expect(candidateMatchesRules(clip, "host", rules)).toBe(true);
		expect(candidateMatchesRules(clip, "other", rules)).toBe(false);
		expect(candidateMatchesRules({ ...clip, createdAt: rules.endedAt }, "host", rules)).toBe(false);
		expect(candidateMatchesRules({ ...clip, views: 19 }, "host", rules)).toBe(false);
		expect(candidateMatchesRules({ ...clip, title: "Lampe spoiler" }, "host", rules)).toBe(false);
	});
	it("does not expose group children or non-nominees", () => {
		const rows = [
			{ id: "a", nominated: true, parentId: null },
			{ id: "b", nominated: true, parentId: "a" },
			{ id: "c", nominated: false, parentId: null },
		];
		expect(visibleCandidates(rows)).toEqual([rows[0]]);
	});
	it("reports shared ties and zero-vote outcomes without inventing a winner", () => {
		expect(
			votingResults(
				[
					{ id: "a", votes: 2 },
					{ id: "b", votes: 2 },
				],
				"shared",
			),
		).toEqual([
			{ id: "a", votes: 2, percentage: 50, winner: true },
			{ id: "b", votes: 2, percentage: 50, winner: true },
		]);
		expect(votingResults([{ id: "a", votes: 0 }], "shared")[0]).toMatchObject({ percentage: 0, winner: false });
	});
	it("holds a tied team decision until the team chooses", () => {
		expect(
			votingResults(
				[
					{ id: "a", votes: 2 },
					{ id: "b", votes: 2 },
				],
				"team",
			).every((r) => !r.winner),
		).toBe(true);
		expect(
			votingResults(
				[
					{ id: "a", votes: 2 },
					{ id: "b", votes: 2 },
				],
				"team",
				"b",
			)[1].winner,
		).toBe(true);
	});
	it.each(["javascript:alert(1)", "http://example.com/image.png"])("rejects unsafe media %s", (thumbnailUrl) => expect(candidateInputSchema.safeParse({ ...clip, thumbnailUrl }).success).toBe(false));
});

it("accepts event-owned media routes without allowing arbitrary relative URLs", () => {
	const mediaUrl = "/api/events/4455a7b3-993d-4cf6-b9d3-52a9c03a0ba2/media/8c317b25-5083-4cae-b939-0487a7fa8ff6";
	expect(candidateInputSchema.safeParse({ ...clip, kind: "image", mediaUrl }).success).toBe(true);
	expect(candidateInputSchema.safeParse({ ...clip, kind: "image", mediaUrl: "//evil.example/image" }).success).toBe(false);
});
