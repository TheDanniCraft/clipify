/** @jest-environment node */
let discovery: any;
try {
	discovery = require("@/server/resources/clip-discovery");
} catch {}
const clips = [
	{ id: "Early", title: "Minecraft caves", game_id: "27471", created_at: "2026-10-06T00:00:00Z", view_count: 10, duration: 10 },
	{ id: "Late", title: "Minecraft farms", game_id: "27471", created_at: "2026-10-06T12:00:00Z", view_count: 100, duration: 20 },
	{ id: "Other", title: "Other game", game_id: "123", created_at: "2026-10-07T00:00:00Z", view_count: 50, duration: 15 },
];
describe("TDD-US2-FILTER deterministic clip discovery", () => {
	test.each([
		[{ startedAt: "2026-10-06T00:00:00Z", endedAt: "2026-10-07T00:00:00Z" }, undefined, ["Late", "Early"]],
		[{ title: "cAvEs" }, undefined, ["Early"]],
		[{ minViews: 50 }, undefined, ["Other", "Late"]],
		[{ minDuration: 10, maxDuration: 10 }, undefined, ["Early"]],
		[{ sort: "most_viewed" }, undefined, ["Late", "Other", "Early"]],
		[{}, "27471", ["Late", "Early"]],
		[{ title: "missing" }, undefined, []],
	])("filters %j with category %s", (filters, category, expected) => {
		expect(discovery?.filterDiscoveredClips).toEqual(expect.any(Function));
		expect(discovery.filterDiscoveredClips(clips, filters, category).map((c: any) => c.id)).toEqual(expected);
	});
});

export {};

test("equal timestamps and view counts use deterministic clip ID ordering", () => {
	const tied = [
		{ ...clips[0], id: "Z" },
		{ ...clips[0], id: "A" },
	];
	expect(discovery.filterDiscoveredClips(tied, {}).map((c: any) => c.id)).toEqual(["A", "Z"]);
	expect(discovery.filterDiscoveredClips(tied, { sort: "most_viewed" }).map((c: any) => c.id)).toEqual(["A", "Z"]);
});
test("missing view counts are treated as zero for filtering and sorting", () => {
	const missing = { id: "Missing", title: "Title", created_at: "2026-10-06T00:00:00Z", duration: 10 };
	expect(discovery.filterDiscoveredClips([missing], { minViews: 1 })).toEqual([]);
	expect(discovery.filterDiscoveredClips([missing, ...clips], { sort: "most_viewed" }).at(-1).id).toBe("Missing");
});
test.each([undefined, "not a URL", "http://static-cdn.jtvnw.net/clip.jpg", "https://user:pass@static-cdn.jtvnw.net/clip.jpg", "https://evil.example/clip.jpg"])("public clip projection rejects unsafe thumbnail %s", (thumbnail_url) => {
	const result = discovery.publicClip({ ...clips[0], thumbnail_url, secret: "private" });
	expect(result.thumbnailUrl).toBeNull();
	expect(JSON.stringify(result)).not.toContain("private");
});
test("public clip projection retains approved HTTPS CDN thumbnails and safe defaults", () => {
	const result = discovery.publicClip({ id: "Clip", title: "Title", duration: 12, created_at: "2026-10-06T00:00:00Z", thumbnail_url: "https://clips.twitchcdn.net/clip.jpg" });
	expect(result).toMatchObject({ categoryId: null, views: 0, thumbnailUrl: "https://clips.twitchcdn.net/clip.jpg", url: "https://clips.twitch.tv/Clip" });
});
