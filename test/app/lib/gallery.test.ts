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

	it("uses locale-independent casing for live filters", () => {
		const localeLowerCase = jest.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(function (this: string) {
			return String(this).replaceAll("I", "ı").toLowerCase();
		});
		const configured = gallery({ liveTimeWindow: "all", includeCategories: ["I"], creatorAllowlist: ["Iris"], titleBlacklist: ["I"] });
		const matching = clip("matching", "2026-08-03T10:00:00Z", 50, { game_id: "i", creator_name: "IRIS", title: "Allowed" });
		const blocked = clip("blocked", "2026-08-03T09:00:00Z", 50, { game_id: "i", creator_name: "IRIS", title: "Contains I" });

		expect(resolveLiveGalleryClips(configured, [matching, blocked], new Date("2026-08-04T00:00:00Z")).map((item) => item.id)).toEqual(["matching"]);
		expect(localeLowerCase).not.toHaveBeenCalled();
		localeLowerCase.mockRestore();
	});

	it("maps custom date ranges to a Free preset and preserves the oldest gallery publication", () => {
		expect(closestFreeTimeWindow(new Date("2026-07-29T00:00:00Z"), new Date("2026-08-03T00:00:00Z"), new Date("2026-08-03T00:00:00Z"))).toBe("7d");
		expect(downgradeGalleryPatch(gallery({ liveTimeWindow: "custom", liveCustomStart: new Date("2026-07-29T00:00:00Z"), liveCustomEnd: new Date("2026-08-03T00:00:00Z") }), true).published).toBe(true);
		expect(downgradeGalleryPatch(gallery(), false).published).toBe(false);
	});

	it.each([
		[null, null, "all"],
		["2026-08-02T00:00:00Z", null, "today"],
		["2026-07-27T00:00:00Z", null, "7d"],
		["2026-07-20T00:00:00Z", null, "7d"],
		["2026-06-11T00:00:00Z", null, "30d"],
		["2026-05-31T23:59:59Z", null, "all"],
		["2026-08-04T00:00:00Z", "2026-08-05T00:00:00Z", "today"],
	])("maps the date range %s to %s", (start, end, expected) => {
		expect(closestFreeTimeWindow(start ? new Date(start) : null, end ? new Date(end) : null, new Date("2026-08-03T00:00:00Z"))).toBe(expected);
	});

	it("normalizes names, layouts, card counts, toggles, and invalid numeric values", () => {
		const current = gallery({ name: "Existing", layout: "list" });
		const normalized = normalizeGalleryPatch(
			current,
			{
				name: "  New name  ",
				layout: "carousel",
				gridMobileColumns: Number.NaN,
				gridTabletColumns: 3.6,
				gridDesktopColumns: -4,
				listDensity: "compact",
				carouselMobileCards: 9,
				carouselTabletCards: 0,
				carouselDesktopCards: 4.6,
				carouselShowNavigation: false,
				carouselShowIndicators: false,
				showTitle: false,
				showCreator: false,
				showViews: false,
				showDuration: false,
				showCreatedAt: true,
			},
			false,
		);

		expect(normalized).toMatchObject({
			name: "New name",
			layout: "carousel",
			gridMobileColumns: 1,
			gridTabletColumns: 4,
			gridDesktopColumns: 2,
			listDensity: "compact",
			carouselMobileCards: 2,
			carouselTabletCards: 1,
			carouselDesktopCards: 5,
			carouselShowNavigation: false,
			carouselShowIndicators: false,
			showTitle: false,
			showCreator: false,
			showViews: false,
			showDuration: false,
			showCreatedAt: true,
		});
		expect(normalizeGalleryPatch(current, { name: "", layout: "invalid" as never, listDensity: "invalid" as never }, false)).toMatchObject({ name: "Existing", layout: "list", listDensity: "comfortable" });
		expect(normalizeGalleryPatch(current, { name: "x".repeat(140) }, false).name).toHaveLength(120);
	});

	it("clears live-only configuration when changing to curated and keeps it when already curated", () => {
		const live = gallery({ liveSort: "stable_random", liveTimeWindow: "custom", liveCustomStart: new Date(), liveCustomEnd: new Date(), liveResultLimit: 90, includeCategories: ["one"], excludeCategories: ["two"], minimumViews: 4, minimumDuration: 5, maximumDuration: 6, titleBlacklist: ["bad"], creatorAllowlist: ["alice"], creatorBlocklist: ["bob"] });
		const switched = normalizeGalleryPatch(live, { source: "curated", playlistId: "playlist" }, true);
		expect(switched).toMatchObject({ source: "curated", playlistId: "playlist", liveSort: "newest", liveTimeWindow: "30d", liveCustomStart: null, liveCustomEnd: null, liveResultLimit: 12, includeCategories: [], excludeCategories: [], minimumViews: 0, minimumDuration: 0, maximumDuration: 0, titleBlacklist: [], creatorAllowlist: [], creatorBlocklist: [] });

		const curated = gallery({ source: "curated", playlistId: "old", liveSort: "most_viewed", liveTimeWindow: "7d", liveResultLimit: 20 });
		expect(normalizeGalleryPatch(curated, { playlistId: "new" }, true)).toMatchObject({ playlistId: "new", liveSort: "most_viewed", liveTimeWindow: "7d", liveResultLimit: 20 });
		expect(normalizeGalleryPatch(curated, { source: "live" }, true).playlistId).toBeNull();
	});

	it("normalizes Pro filters, styling, colors, and contrast", () => {
		const values = Array.from({ length: 105 }, (_unused, index) => ` value-${index} `);
		const normalized = normalizeGalleryPatch(
			gallery(),
			{
				liveSort: "stable_random",
				liveTimeWindow: "custom",
				liveCustomStart: new Date("2026-01-01T00:00:00Z"),
				liveCustomEnd: new Date("2026-02-01T00:00:00Z"),
				liveResultLimit: 500,
				includeCategories: [" game ", "game", "", ...values],
				excludeCategories: [" excluded "],
				minimumViews: 2_000_000_000,
				minimumDuration: -5,
				maximumDuration: 5000,
				titleBlacklist: [" bad "],
				creatorAllowlist: [" alice "],
				creatorBlocklist: [" bob "],
				theme: "dark",
				accentColor: " #123456 ",
				backgroundMode: "solid",
				backgroundColor: "rgb(1, 2, 3)",
				cardSurfaceColor: "#ffffff",
				textColor: "#fefefe",
				cardRadius: 99,
				gap: 0,
				thumbnailTreatment: "contain",
				modalBackdrop: "rgba(0, 0, 0, 0.5)",
				desktopModalWidth: 2000,
			},
			true,
		);

		expect(normalized).toMatchObject({ liveSort: "stable_random", liveTimeWindow: "custom", liveResultLimit: 100, minimumViews: 1_000_000_000, minimumDuration: 0, maximumDuration: 3600, theme: "dark", accentColor: "#123456", backgroundMode: "solid", backgroundColor: "rgb(1, 2, 3)", cardSurfaceColor: "#ffffff", textColor: "#000000", cardRadius: 32, gap: 4, thumbnailTreatment: "contain", modalBackdrop: "rgba(0, 0, 0, 0.5)", desktopModalWidth: 1440 });
		expect(normalized.includeCategories).toHaveLength(100);
		expect(normalized.includeCategories?.[0]).toBe("game");
		expect(normalized.excludeCategories).toEqual(["excluded"]);
		expect(normalized.titleBlacklist).toEqual(["bad"]);
		expect(normalized.creatorAllowlist).toEqual(["alice"]);
		expect(normalized.creatorBlocklist).toEqual(["bob"]);
	});

	it("uses safe Pro styling defaults for invalid values and allows non-hex colors without forcing contrast", () => {
		const normalized = normalizeGalleryPatch(gallery(), { theme: "invalid" as never, accentColor: "red", backgroundMode: "invalid" as never, backgroundColor: null as never, cardSurfaceColor: "rgb(1, 2, 3)", textColor: "rgba(255, 255, 255, .9)", thumbnailTreatment: "invalid" as never, modalBackdrop: "nope", desktopModalWidth: Number.NaN }, true);
		expect(normalized).toMatchObject({ theme: "system", accentColor: "#7C3AED", backgroundMode: "transparent", backgroundColor: "#000000", cardSurfaceColor: "rgb(1, 2, 3)", textColor: "rgba(255, 255, 255, .9)", thumbnailTreatment: "cover", modalBackdrop: "rgba(0,0,0,0.72)", desktopModalWidth: 960 });
	});

	it.each(["today", "7d", "30d", "all", "custom"] as const)("applies the %s live time window", (liveTimeWindow) => {
		const now = new Date("2026-08-03T12:00:00Z");
		const configured = gallery({ liveTimeWindow, liveCustomStart: new Date("2026-08-02T00:00:00Z"), liveCustomEnd: liveTimeWindow === "custom" ? new Date("2026-08-03T12:00:00Z") : null });
		const clips = [clip("yesterday", "2026-08-02T12:00:00Z", 1), clip("today", "2026-08-03T01:00:00Z", 2), clip("future", "2026-08-04T00:00:00Z", 3), clip("invalid", "not-a-date", 4)];
		const ids = resolveLiveGalleryClips(configured, clips, now).map((item) => item.id);
		expect(ids).not.toContain("future");
		expect(ids).not.toContain("invalid");
		expect(ids).toContain("today");
		expect(ids.includes("yesterday")).toBe(liveTimeWindow !== "today" && liveTimeWindow !== "custom" ? true : liveTimeWindow === "custom");
	});

	it("rejects every advanced filter mismatch and honors result limits and sort tie breakers", () => {
		const configured = gallery({ liveTimeWindow: "all", liveSort: "most_viewed", liveResultLimit: 2, minimumViews: 10, minimumDuration: 5, maximumDuration: 30, includeCategories: ["game"], excludeCategories: ["excluded"], creatorAllowlist: ["alice"], creatorBlocklist: ["blocked"], titleBlacklist: ["forbidden"] });
		const clips = [
			clip("valid-old", "2026-08-01T00:00:00Z", 100, { creator_name: "Alice", duration: 20 }),
			clip("valid-new", "2026-08-02T00:00:00Z", 100, { creator_name: "Alice", duration: 20 }),
			clip("third", "2026-08-03T00:00:00Z", 50, { creator_name: "Alice", duration: 20 }),
			clip("views", "2026-08-03T00:00:00Z", 9, { creator_name: "Alice" }),
			clip("short", "2026-08-03T00:00:00Z", 20, { creator_name: "Alice", duration: 4 }),
			clip("long", "2026-08-03T00:00:00Z", 20, { creator_name: "Alice", duration: 31 }),
			clip("included", "2026-08-03T00:00:00Z", 20, { creator_name: "Alice", game_id: "other" }),
			clip("excluded", "2026-08-03T00:00:00Z", 20, { creator_name: "Alice", game_id: "excluded" }),
			clip("creator", "2026-08-03T00:00:00Z", 20, { creator_name: "Bob" }),
			clip("blocked", "2026-08-03T00:00:00Z", 20, { creator_name: "Blocked" }),
			clip("title", "2026-08-03T00:00:00Z", 20, { creator_name: "Alice", title: "Forbidden moment" }),
		];
		expect(resolveLiveGalleryClips(configured, clips, new Date("2026-08-04T00:00:00Z")).map((item) => item.id)).toEqual(["valid-new", "valid-old"]);
	});

	it("keeps stable-random ordering deterministic for a gallery", () => {
		const configured = gallery({ liveTimeWindow: "all", liveSort: "stable_random" });
		const clips = [clip("one", "2026-08-01T00:00:00Z", 1), clip("two", "2026-08-02T00:00:00Z", 2), clip("three", "2026-08-03T00:00:00Z", 3)];
		const first = resolveLiveGalleryClips(configured, clips).map((item) => item.id);
		const second = resolveLiveGalleryClips(configured, [...clips].reverse()).map((item) => item.id);
		expect(second).toEqual(first);
	});

	it("produces the complete Free downgrade and preserves supported Free selections", () => {
		const downgraded = downgradeGalleryPatch(gallery({ liveResultLimit: 99, liveSort: "most_viewed", liveTimeWindow: "7d", theme: "dark", accentColor: "#123456", backgroundMode: "solid" }), true);
		expect(downgraded).toEqual({
			published: true,
			liveResultLimit: FREE_GALLERY_LIVE_LIMIT,
			liveSort: "most_viewed",
			liveTimeWindow: "7d",
			liveCustomStart: null,
			liveCustomEnd: null,
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
		});
		expect(downgradeGalleryPatch(gallery({ liveSort: "stable_random", liveTimeWindow: "custom", liveCustomStart: null }), false)).toMatchObject({ published: false, liveSort: "newest", liveTimeWindow: "all" });
	});
});
