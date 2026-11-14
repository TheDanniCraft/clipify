jest.mock("server-only", () => ({}));
jest.mock("@/server/resources/clip-validation", () => ({ resolveValidatedPlaylistClips: jest.fn() }));
jest.mock("@/server/resources/clip-discovery", () => ({ fetchClipDiscovery: jest.fn() }));
import { resolveValidatedPlaylistClips } from "@/server/resources/clip-validation";
import { resolveAwardSource, searchAwardClips } from "@/server/events/sources";
const category = { id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", title: "Fail", group: "", source: "clip" as const, selection: "audience" as const, submissionLimit: 1, nomineeLimit: 6, rules: { minViews: 2 }, options: [] };
const clip = { id: "ActualClip", title: "Actual title", broadcaster_id: "host", created_at: "2026-01-01T00:00:00Z", duration: 30, view_count: 10, thumbnail_url: "https://clips-media-assets2.twitch.tv/clip.jpg" };
it("resolves pasted clip URLs to provider metadata rather than trusting viewer metadata", async () => {
	jest.mocked(resolveValidatedPlaylistClips).mockResolvedValue([clip]);
	expect(await resolveAwardSource("host", category, { reference: "https://clips.twitch.tv/ActualClip", title: "Fabricated" })).toMatchObject({ kind: "clip", reference: "ActualClip", title: "Actual title", views: 10 });
	expect(resolveValidatedPlaylistClips).toHaveBeenCalledWith("host", ["ActualClip"]);
});
it("rejects foreign and ineligible direct clips", async () => {
	jest.mocked(resolveValidatedPlaylistClips).mockResolvedValue([{ ...clip, broadcaster_id: "other" }]);
	await expect(resolveAwardSource("host", category, { reference: "ActualClip" })).rejects.toThrow("INVALID_INPUT");
	jest.mocked(resolveValidatedPlaylistClips).mockResolvedValue([{ ...clip, view_count: 1 }]);
	await expect(resolveAwardSource("host", category, { reference: "ActualClip" })).rejects.toThrow("INVALID_INPUT");
});
it("rejects unsupported choice and unsafe arbitrary links", async () => {
	await expect(resolveAwardSource("host", { ...category, source: "choice", options: ["Lime", "Peach"] }, { reference: "Wrong" })).rejects.toThrow("INVALID_INPUT");
	await expect(resolveAwardSource("host", { ...category, source: "link" }, { reference: "javascript:alert(1)", title: "Test" })).rejects.toThrow("INVALID_INPUT");
});
it("uses direct clip lookup for pasted links in the autocomplete", async () => {
	jest.mocked(resolveValidatedPlaylistClips).mockResolvedValue([clip]);
	expect(await searchAwardClips("host", category, "https://clips.twitch.tv/ActualClip")).toMatchObject([{ reference: "ActualClip", title: "Actual title" }]);
});

jest.mock("@/app/actions/twitch", () => ({ getGameDetails: jest.fn(), getTwitchGames: jest.fn() }));
import { getGameDetails } from "@/app/actions/twitch";
it("resolves a Twitch game ID to its catalog name and cover", async () => {
	jest.mocked(getGameDetails).mockResolvedValue({ id: "42", name: "Side Game", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/42-{width}x{height}.jpg", igdb_id: "" });
	expect(await resolveAwardSource("host", { ...category, source: "game", rules: {} }, { reference: "42", title: "Fake" })).toMatchObject({ kind: "game", reference: "42", title: "Side Game", thumbnailUrl: "https://static-cdn.jtvnw.net/ttv-boxart/42-480x640.jpg" });
	await expect(resolveAwardSource("host", { ...category, source: "game", rules: {} }, { reference: "not-an-id" })).rejects.toThrow("INVALID_INPUT");
});

jest.mock("@/server/events/youtube", () => ({ resolveAwardYoutube: jest.fn(), searchAwardYoutube: jest.fn() }));
import { resolveAwardYoutube } from "@/server/events/youtube";
it("applies category rules to resolved YouTube videos too", async () => {
	jest.mocked(resolveAwardYoutube).mockResolvedValue({ kind: "youtube", reference: "abcdefghijk", title: "Video", description: "", views: 1 });
	await expect(resolveAwardSource("host", { ...category, source: "youtube" }, { reference: "https://youtu.be/abcdefghijk" })).rejects.toThrow("INVALID_INPUT");
	jest.mocked(resolveAwardYoutube).mockResolvedValue({ kind: "youtube", reference: "abcdefghijk", title: "Video", description: "", views: 20 });
	expect(await resolveAwardSource("host", { ...category, source: "youtube" }, { reference: "https://youtu.be/abcdefghijk" })).toMatchObject({ kind: "youtube", views: 20 });
});

jest.mock("@/db/client", () => ({ db: { select: jest.fn(), transaction: jest.fn() } }));
import { db } from "@/db/client";
import { getTwitchGames } from "@/app/actions/twitch";
import { searchEventSources } from "@/server/events/sources";
it("routes a public game autocomplete through the host's Twitch catalog", async () => {
	const event = { ownerId: "host", publishedAt: new Date(), reviewReleased: false, resultsPublishedAt: null, configuration: { schedule: { submissionsStart: "2020-01-01T00:00:00Z", submissionsEnd: "2099-01-01T00:00:00Z", votingStart: "2099-02-01T00:00:00Z", votingEnd: "2099-03-01T00:00:00Z", reviewRequired: true, timezone: "UTC" }, categories: [{ ...category, source: "game", rules: {} }] } };
	const query = { from: () => query, innerJoin: () => query, where: () => query, limit: () => query, for: async () => [event] };
	(db.transaction as jest.Mock).mockImplementation(async (run) => run(db));
	(db.select as jest.Mock).mockReturnValue(query);
	jest.mocked(getTwitchGames).mockResolvedValue([{ id: "42", name: "Side Game", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/42-{width}x{height}.jpg", igdb_id: "" }]);
	expect(await searchEventSources("4455a7b3-993d-4cf6-b9d3-52a9c03a0ba2", category.id, "Side")).toMatchObject([{ kind: "game", title: "Side Game" }]);
	expect(getTwitchGames).toHaveBeenCalledWith("Side", "host");
});
it("keeps trusted clip attribution and timing in pasted-link search suggestions", async () => {
	jest.mocked(resolveValidatedPlaylistClips).mockResolvedValue([{ ...clip, creator_name: "ActualClipper" }]);
	expect(await searchAwardClips("host", category, "https://clips.twitch.tv/ActualClip")).toMatchObject([{ clipperName: "ActualClipper", duration: 30, createdAt: "2026-01-01T00:00:00Z" }]);
});
