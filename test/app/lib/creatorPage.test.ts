import { queryCreatorClips, resolveCreatorPageMetadata, resolveCreatorPageVisibility } from "@lib/creatorPage";
import type { TwitchClip } from "@types";

const clip = (id: string, created_at: string, view_count: number): TwitchClip => ({ id, created_at, view_count, url: `https://clips.twitch.tv/${id}`, embed_url: "", broadcaster_id: "owner", broadcaster_name: "Owner", creator_id: "creator", creator_name: "Creator", video_id: "", game_id: "game", language: "en", title: id, thumbnail_url: `${id}.jpg`, duration: 10 });

describe("creator page domain", () => {
	it("uses custom social preview metadata when configured", () => {
		expect(resolveCreatorPageMetadata("Danny", "Danny live clips", "The best moments from Danny.")).toEqual({
			title: "Danny live clips",
			description: "The best moments from Danny.",
			openGraphTitle: "Danny live clips",
			openGraphDescription: "The best moments from Danny.",
		});
	});

	it("falls back to Clipify metadata when social preview fields are empty", () => {
		expect(resolveCreatorPageMetadata("Danny", " ", null)).toEqual({
			title: "Danny's Twitch clips | Clipify",
			description: "Watch the newest and most-viewed Twitch clips from Danny.",
			openGraphTitle: "Danny's Twitch clips",
			openGraphDescription: "Watch clips from Danny on Clipify.",
		});
	});
	it("preserves the prior Community choice until the explicit visibility field exists", () => {
		expect(resolveCreatorPageVisibility({ creatorPageVisibility: null, showOnCommunityPage: true })).toBe("discoverable");
		expect(resolveCreatorPageVisibility({ creatorPageVisibility: null, showOnCommunityPage: false })).toBe("unlisted");
		expect(resolveCreatorPageVisibility({ creatorPageVisibility: "discoverable", showOnCommunityPage: false })).toBe("discoverable");
	});

	it("sorts, filters, and cursor-paginates without a plan cap", () => {
		const clips = [clip("old", "2025-01-01T00:00:00Z", 500), clip("new", "2026-08-01T00:00:00Z", 5), clip("popular", "2026-07-01T00:00:00Z", 50)];
		expect(queryCreatorClips(clips, { sort: "most_viewed", pageSize: 2 }).items.map((item) => item.id)).toEqual(["old", "popular"]);
		expect(queryCreatorClips(clips, { sort: "newest", start: new Date("2026-01-01"), pageSize: 1 }).items[0]?.id).toBe("new");
		expect(queryCreatorClips(clips, { sort: "newest", cursor: "1", pageSize: 2 }).items.map((item) => item.id)).toEqual(["popular", "old"]);
	});
});
