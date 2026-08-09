import { FREE_GALLERY_LIVE_LIMIT, closestFreeTimeWindow, downgradeGalleryPatch, normalizeGalleryPatch, resolveLiveGalleryClips } from "@lib/gallery";
import type { Gallery, TwitchClip } from "@types";

const gallery = (patch: Partial<Gallery> = {}) =>
	({
		id: "11111111-1111-1111-1111-111111111111",
		ownerId: "owner",
		name: "Highlights",
		published: true,
		source: "live",
		playlistId: null,
		layout: "grid",
		gridAuto: true,
		gridMobileColumns: 1,
		gridTabletColumns: 3,
		gridDesktopColumns: 4,
		listDensity: "comfortable",
		carouselMobileCards: 1,
		carouselTabletCards: 2,
		carouselDesktopCards: 3,
		carouselShowNavigation: true,
		carouselShowIndicators: true,
		showTitle: true,
		showCreator: true,
		showViews: true,
		showDuration: true,
		showCreatedAt: false,
		liveSort: "newest",
		liveTimeWindow: "30d",
		liveCustomStart: null,
		liveCustomEnd: null,
		liveResultLimit: 12,
		includeCategories: [],
		excludeCategories: [],
		minimumViews: 0,
		minimumDuration: 0,
		maximumDuration: 0,
		titleBlacklist: [],
		creatorAllowlist: [],
		creatorBlocklist: [],
		theme: "system",
		accentColor: "#7C3AED",
		backgroundMode: "transparent",
		backgroundColor: "#000000",
		cardSurfaceColor: "#18181B",
		textColor: "#FFFFFF",
		cardRadius: 16,
		gap: 16,
		thumbnailTreatment: "cover",
		modalBackdrop: "rgba(0,0,0,0.72)",
		desktopModalWidth: 960,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		...patch,
	}) as Gallery;

const clip = (id: string, createdAt: string, views: number, patch: Partial<TwitchClip> = {}): TwitchClip => ({ id, url: `https://clips.twitch.tv/${id}`, embed_url: "", broadcaster_id: "owner", broadcaster_name: "Owner", creator_id: `creator-${id}`, creator_name: `Creator ${id}`, video_id: "", game_id: "game", language: "en", title: `Clip ${id}`, view_count: views, created_at: createdAt, thumbnail_url: `${id}.jpg`, duration: 20, ...patch });

describe("gallery domain rules", () => {
	it("clamps Free live settings and rejects Pro-only precision", () => {
		const current = gallery();
		const normalized = normalizeGalleryPatch(current, { liveSort: "stable_random", liveTimeWindow: "custom", liveResultLimit: 100, minimumViews: 500, creatorAllowlist: ["Alice"] }, false);
		expect(normalized.liveSort).toBe("newest");
		expect(normalized.liveTimeWindow).toBe("30d");
		expect(normalized.liveResultLimit).toBe(FREE_GALLERY_LIVE_LIMIT);
		expect(normalized.minimumViews).toBe(0);
		expect(normalized.creatorAllowlist).toEqual([]);
	});

	it("allows structural layout controls for Free while clamping safe columns", () => {
		const normalized = normalizeGalleryPatch(gallery(), { layout: "grid", gridAuto: false, gridMobileColumns: 9, gridTabletColumns: 1, gridDesktopColumns: 99 }, false);
		expect(normalized.gridMobileColumns).toBe(2);
		expect(normalized.gridTabletColumns).toBe(2);
		expect(normalized.gridDesktopColumns).toBe(6);
	});

	it("resolves newest and most-viewed clips inside the selected time window", () => {
		const now = new Date("2026-08-03T12:00:00Z");
		const clips = [clip("old", "2026-06-01T00:00:00Z", 1000), clip("new", "2026-08-03T10:00:00Z", 5), clip("popular", "2026-08-02T10:00:00Z", 50)];
		expect(resolveLiveGalleryClips(gallery({ liveTimeWindow: "7d" }), clips, now).map((item) => item.id)).toEqual(["new", "popular"]);
		expect(resolveLiveGalleryClips(gallery({ liveTimeWindow: "7d", liveSort: "most_viewed" }), clips, now).map((item) => item.id)).toEqual(["popular", "new"]);
	});

	it("applies Pro filters and produces stable random ordering", () => {
		const clips = [clip("a", "2026-08-03T10:00:00Z", 50, { creator_name: "Alice" }), clip("b", "2026-08-03T09:00:00Z", 80, { creator_name: "Bob" }), clip("c", "2026-08-03T08:00:00Z", 90, { creator_name: "Alice", title: "Blocked moment" })];
		const configured = gallery({ liveTimeWindow: "all", liveSort: "stable_random", minimumViews: 20, creatorAllowlist: ["alice"], titleBlacklist: ["blocked"] });
		const now = new Date("2026-08-04T00:00:00Z");
		const first = resolveLiveGalleryClips(configured, clips, now).map((item) => item.id);
		const second = resolveLiveGalleryClips(configured, [...clips].reverse(), now).map((item) => item.id);
		expect(first).toEqual(["a"]);
		expect(second).toEqual(first);
	});

	it("maps custom date ranges to a Free preset and preserves the oldest gallery publication", () => {
		expect(closestFreeTimeWindow(new Date("2026-07-29T00:00:00Z"), new Date("2026-08-03T00:00:00Z"), new Date("2026-08-03T00:00:00Z"))).toBe("7d");
		expect(downgradeGalleryPatch(gallery({ liveTimeWindow: "custom", liveCustomStart: new Date("2026-07-29T00:00:00Z"), liveCustomEnd: new Date("2026-08-03T00:00:00Z") }), true).published).toBe(true);
		expect(downgradeGalleryPatch(gallery(), false).published).toBe(false);
	});
});
