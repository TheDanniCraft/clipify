/** @jest-environment node */
export {};

import axios from "axios";

const getAccessToken = jest.fn();
const getOverlayBySecret = jest.fn();
const getOverlayPublic = jest.fn();
const getTwitchCache = jest.fn();
const getTwitchCacheByPrefixEntries = jest.fn();
const setTwitchCache = jest.fn();
const setTwitchCacheBatch = jest.fn();
const connect = jest.fn();

jest.mock("@actions/database", () => ({
	deleteTwitchCacheByPrefix: jest.fn(),
	deleteTwitchCacheKeys: jest.fn(),
	getAccessToken: (...args: unknown[]) => getAccessToken(...args),
	getOverlayBySecret: (...args: unknown[]) => getOverlayBySecret(...args),
	getOverlayPublic: (...args: unknown[]) => getOverlayPublic(...args),
	getTwitchCache: (...args: unknown[]) => getTwitchCache(...args),
	getTwitchCacheBatch: jest.fn(),
	getTwitchCacheByPrefixEntries: (...args: unknown[]) => getTwitchCacheByPrefixEntries(...args),
	getTwitchCacheEntry: jest.fn(),
	getTwitchCacheStale: jest.fn(),
	getTwitchCacheStaleBatch: jest.fn(),
	setTwitchCache: (...args: unknown[]) => setTwitchCache(...args),
	setTwitchCacheBatch: (...args: unknown[]) => setTwitchCacheBatch(...args),
}));

jest.mock("@/db/client", () => ({
	dbPool: {
		connect: (...args: unknown[]) => connect(...args),
	},
}));

function buildClip(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		url: `https://clips.twitch.tv/${id}`,
		embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
		broadcaster_id: "owner-1",
		broadcaster_name: "owner",
		creator_id: `creator-${id}`,
		creator_name: `Creator-${id}`,
		video_id: "video-1",
		game_id: "game-1",
		language: "en",
		title: `clip-${id}`,
		view_count: 10,
		created_at: "2026-03-08T00:00:00.000Z",
		thumbnail_url: "https://thumb",
		duration: 30,
		...overrides,
	};
}

function buildOverlay(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "overlay-1",
		ownerId: "owner-1",
		secret: "secret",
		name: "Overlay",
		status: "active",
		type: "All",
		rewardId: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		lastUsedAt: null,
		minClipDuration: 0,
		maxClipDuration: 60,
		maxDurationMode: "filter",
		minClipViews: 0,
		blacklistWords: [],
		playbackMode: "random",
		preferCurrentCategory: false,
		clipCreatorsOnly: [],
		clipCreatorsBlocked: [],
		clipPackSize: 100,
		playerVolume: 50,
		showChannelInfo: true,
		showClipInfo: true,
		showTimer: false,
		showProgressBar: false,
		overlayInfoFadeOutSeconds: 6,
		themeFontFamily: "inherit",
		themeTextColor: "#FFFFFF",
		themeAccentColor: "#7C3AED",
		themeBackgroundColor: "rgba(10,10,10,0.65)",
		progressBarStartColor: "#26018E",
		progressBarEndColor: "#8D42F9",
		borderSize: 0,
		borderRadius: 10,
		effectScanlines: false,
		effectStatic: false,
		effectCrt: false,
		channelInfoX: 0,
		channelInfoY: 0,
		clipInfoX: 100,
		clipInfoY: 100,
		timerX: 100,
		timerY: 0,
		channelScale: 100,
		clipScale: 100,
		timerScale: 100,
		...overrides,
	} as never;
}

function cacheEntriesFromClips(clips: ReturnType<typeof buildClip>[]) {
	return clips.map((clip) => ({
		key: `clip:owner-1:${clip.id}`,
		value: clip,
	}));
}

function createLockClient(locked: boolean) {
	return {
		query: jest.fn().mockResolvedValue({ rows: [{ locked }] }),
		release: jest.fn(),
	};
}

async function loadTwitch() {
	return import("@/app/actions/twitch");
}

describe("actions/twitch playback and cache behavior", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
		connect.mockResolvedValue(createLockClient(false));
		getAccessToken.mockResolvedValue({ accessToken: "token" });
		getOverlayBySecret.mockResolvedValue(buildOverlay());
		getOverlayPublic.mockResolvedValue(buildOverlay());
		getTwitchCache.mockResolvedValue({});
		getTwitchCacheByPrefixEntries.mockResolvedValue([]);
	});

	it("filters clips using duration, blacklist, creator and view constraints, then sorts by top mode", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:top-1", value: buildClip("top-1", { creator_name: "Allowed", creator_id: "allowed", title: "Good Clip", duration: 25, view_count: 120 }) },
			{ key: "clip:owner-1:top-2", value: buildClip("top-2", { creator_name: "Allowed", creator_id: "allowed", title: "Best Clip", duration: 25, view_count: 220 }) },
			{ key: "clip:owner-1:too-short", value: buildClip("too-short", { creator_name: "Allowed", creator_id: "allowed", duration: 2, view_count: 500 }) },
			{ key: "clip:owner-1:blacklisted", value: buildClip("blacklisted", { creator_name: "Allowed", creator_id: "allowed", title: "spoiler ending", duration: 30, view_count: 400 }) },
			{ key: "clip:owner-1:blocked-creator", value: buildClip("blocked-creator", { creator_name: "BlockedOne", creator_id: "blocked", duration: 30, view_count: 400 }) },
			{ key: "clip:owner-1:low-views", value: buildClip("low-views", { creator_name: "Allowed", creator_id: "allowed", duration: 30, view_count: 3 }) },
		]);

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(
			buildOverlay({
				minClipDuration: 10,
				maxClipDuration: 60,
				blacklistWords: ["spoiler"],
				clipCreatorsOnly: ["allowed"],
				clipCreatorsBlocked: ["blockedone"],
				minClipViews: 100,
				playbackMode: "top",
			}),
		);

		expect(clips.map((clip) => clip.id)).toEqual(["top-2", "top-1"]);
	});

	it("short-circuits Queue overlays without reading cached clips", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue(cacheEntriesFromClips([buildClip("would-not-load")]));

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay({ type: "Queue" }));

		expect(clips).toEqual([]);
		expect(getTwitchCacheByPrefixEntries).not.toHaveBeenCalled();
		expect(connect).not.toHaveBeenCalled();
	});

	it("filters numeric time-window overlay types and drops invalid created_at values", async () => {
		const now = Date.now();
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("recent-clip", { created_at: new Date(now - 6 * 60 * 60 * 1000).toISOString() }),
				buildClip("old-clip", { created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() }),
				buildClip("invalid-date", { created_at: "not-a-date" }),
			]),
		);

		const { getTwitchClips } = await loadTwitch();
		const lastDay = await getTwitchClips(buildOverlay(), "1" as never, true);
		const lastThirtyDays = await getTwitchClips(buildOverlay(), "30" as never, true);

		expect(lastDay.map((clip) => clip.id)).toEqual(["recent-clip"]);
		expect(lastThirtyDays.map((clip) => clip.id)).toEqual(["recent-clip", "old-clip"]);
	});

	it("ignores non-numeric overlay type values and leaves clip list unchanged", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("clip-a"),
				buildClip("clip-b"),
			]),
		);

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay(), "not-a-number" as never, true);

		expect(clips.map((clip) => clip.id)).toEqual(["clip-a", "clip-b"]);
	});

	it("bypasses all clip filters when skipFilter is true, even in top playback mode", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("short", { duration: 5, view_count: 5, title: "short title", creator_name: "Other" }),
				buildClip("blocked-word", { duration: 20, title: "spoiler ending", view_count: 20, creator_name: "Allowed", creator_id: "allowed" }),
				buildClip("blocked-creator", { duration: 20, title: "clean", view_count: 30, creator_name: "Blocked", creator_id: "blocked-id" }),
				buildClip("good", { duration: 20, title: "clean", view_count: 40, creator_name: "Allowed", creator_id: "allowed" }),
			]),
		);

		const strictOverlay = buildOverlay({
			minClipDuration: 10,
			maxClipDuration: 30,
			blacklistWords: ["spoiler"],
			clipCreatorsOnly: ["allowed"],
			clipCreatorsBlocked: ["blocked-id"],
			minClipViews: 25,
			playbackMode: "top",
		});
		const { getTwitchClips } = await loadTwitch();
		const filtered = await getTwitchClips(strictOverlay);
		const unfiltered = await getTwitchClips(strictOverlay, undefined, true);

		expect(filtered.map((clip) => clip.id)).toEqual(["good"]);
		expect(unfiltered.map((clip) => clip.id)).toEqual(["short", "blocked-word", "blocked-creator", "good"]);
	});

	it("matches creator allow and block lists by id case-insensitively", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("allowed-id", { creator_id: "Creator-Allowed", creator_name: "Someone", title: "clean", duration: 20, view_count: 50 }),
				buildClip("blocked-id", { creator_id: "Creator-Blocked", creator_name: "Someone", title: "clean", duration: 20, view_count: 50 }),
				buildClip("not-listed", { creator_id: "Creator-Other", creator_name: "Someone", title: "clean", duration: 20, view_count: 50 }),
			]),
		);

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(
			buildOverlay({
				clipCreatorsOnly: ["creator-allowed", "creator-blocked", "creator-other"],
				clipCreatorsBlocked: ["CREATOR-BLOCKED"],
			}),
		);

		expect(clips.map((clip) => clip.id)).toEqual(["allowed-id", "not-listed"]);
	});

	it("prefers current category clips when category preference is enabled", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:cat-a", value: buildClip("cat-a", { game_id: "game-a", view_count: 100 }) },
			{ key: "clip:owner-1:cat-b", value: buildClip("cat-b", { game_id: "game-b", view_count: 50 }) },
		]);
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [{ game_id: "game-b" }],
			},
		} as never);

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay({ preferCurrentCategory: true }));

		expect(clips.map((clip) => clip.id)).toEqual(["cat-b"]);
	});

	it("keeps full clip set when preferCurrentCategory has no access token or no matching game", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:cat-a", value: buildClip("cat-a", { game_id: "game-a", view_count: 30 }) },
			{ key: "clip:owner-1:cat-b", value: buildClip("cat-b", { game_id: "game-b", view_count: 20 }) },
		]);

		getAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ accessToken: "token" });
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [{ game_id: "game-z" }],
			},
		} as never);

		const { getTwitchClips } = await loadTwitch();
		const noToken = await getTwitchClips(buildOverlay({ preferCurrentCategory: true }), undefined, true);
		const noMatch = await getTwitchClips(buildOverlay({ preferCurrentCategory: true }), undefined, false);

		expect(noToken.map((clip) => clip.id)).toEqual(["cat-a", "cat-b"]);
		expect(noMatch.map((clip) => clip.id)).toEqual(["cat-a", "cat-b"]);
	});

	it("falls back to full filtered clip set when current-category lookup fails", async () => {
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:cat-a", value: buildClip("cat-a", { game_id: "game-a", view_count: 20 }) },
			{ key: "clip:owner-1:cat-b", value: buildClip("cat-b", { game_id: "game-b", view_count: 10 }) },
		]);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		jest.spyOn(axios, "get").mockRejectedValue(new Error("twitch unavailable"));

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay({ preferCurrentCategory: true, playbackMode: "top" }));

		expect(clips.map((clip) => clip.id)).toEqual(["cat-a", "cat-b"]);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("supports featured and time-window overlay types", async () => {
		const now = Date.now();
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:featured", value: buildClip("featured", { created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), is_featured: true }) },
			{ key: "clip:owner-1:not-featured", value: buildClip("not-featured", { created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), is_featured: false }) },
			{ key: "clip:owner-1:old", value: buildClip("old", { created_at: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(), is_featured: true }) },
		]);

		const { getTwitchClips } = await loadTwitch();
		const featured = await getTwitchClips(buildOverlay(), "Featured" as never, true);
		const lastWeek = await getTwitchClips(buildOverlay(), "7" as never, true);

		expect(featured.map((clip) => clip.id)).toEqual(["featured", "old"]);
		expect(lastWeek.map((clip) => clip.id)).toEqual(["featured", "not-featured"]);
	});

	it("builds top batches with exclusions and falls back to all clips when exclusions remove everything", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "top" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:clip-a", value: buildClip("clip-a", { view_count: 20 }) },
			{ key: "clip:owner-1:clip-b", value: buildClip("clip-b", { view_count: 60 }) },
			{ key: "clip:owner-1:clip-c", value: buildClip("clip-c", { view_count: 100 }) },
		]);

		const { getTwitchClipBatch } = await loadTwitch();
		const nonExcluded = await getTwitchClipBatch("overlay-1", undefined, undefined, ["clip-c"], 2, true);
		const fallbackAll = await getTwitchClipBatch("overlay-1", undefined, undefined, ["clip-a", "clip-b", "clip-c"], 2, true);

		expect(nonExcluded.map((clip) => clip.id)).toEqual(["clip-b", "clip-a"]);
		expect(fallbackAll.map((clip) => clip.id)).toEqual(["clip-c", "clip-b"]);
	});

	it("uses created_at as top-mode tie-breaker when view counts are equal", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "top" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("older", { view_count: 100, created_at: "2026-03-01T00:00:00.000Z" }),
				buildClip("newer", { view_count: 100, created_at: "2026-03-09T00:00:00.000Z" }),
				buildClip("lower", { view_count: 10, created_at: "2026-03-10T00:00:00.000Z" }),
			]),
		);

		const { getTwitchClipBatch } = await loadTwitch();
		const batch = await getTwitchClipBatch("overlay-1", undefined, undefined, [], 3, true);

		expect(batch.map((clip) => clip.id)).toEqual(["newer", "older", "lower"]);
	});

	it("keeps serving cached clips when incremental sync API call fails", async () => {
		connect.mockResolvedValue(createLockClient(true));
		getTwitchCache.mockResolvedValue({});
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:cached-1", value: buildClip("cached-1", { view_count: 42 }) },
		]);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		jest.spyOn(axios, "get").mockRejectedValue(new Error("twitch incremental down"));

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay());

		expect(clips.map((clip) => clip.id)).toEqual(["cached-1"]);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("returns unique smart-shuffle batches up to requested size", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "smart_shuffle" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:aa", value: buildClip("aa", { view_count: 10, game_id: "a", creator_id: "x", creator_name: "x" }) },
			{ key: "clip:owner-1:bb", value: buildClip("bb", { view_count: 20, game_id: "a", creator_id: "y", creator_name: "y" }) },
			{ key: "clip:owner-1:cc", value: buildClip("cc", { view_count: 30, game_id: "b", creator_id: "z", creator_name: "z" }) },
			{ key: "clip:owner-1:dd", value: buildClip("dd", { view_count: 40, game_id: "c", creator_id: "w", creator_name: "w" }) },
		]);
		jest.spyOn(Math, "random").mockReturnValue(0.2);

		const { getTwitchClipBatch } = await loadTwitch();
		const batch = await getTwitchClipBatch("overlay-1", undefined, undefined, [], 3, true);

		expect(batch).toHaveLength(3);
		expect(new Set(batch.map((clip) => clip.id)).size).toBe(3);
	});

	it("builds randomized batches for random playback mode", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "random" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:r1", value: buildClip("r1", { view_count: 10 }) },
			{ key: "clip:owner-1:r2", value: buildClip("r2", { view_count: 20 }) },
			{ key: "clip:owner-1:r3", value: buildClip("r3", { view_count: 30 }) },
		]);
		jest.spyOn(Math, "random").mockReturnValue(0.5);

		const { getTwitchClipBatch } = await loadTwitch();
		const batch = await getTwitchClipBatch("overlay-1", undefined, undefined, [], 2, true);

		expect(batch).toHaveLength(2);
		expect(batch.every((clip) => ["r1", "r2", "r3"].includes(clip.id))).toBe(true);
	});

	it("falls back to all candidates in random mode when exclusions remove the full set and clamps batch size", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "random" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("rand-a", { view_count: 10 }),
				buildClip("rand-b", { view_count: 20 }),
				buildClip("rand-c", { view_count: 30 }),
			]),
		);
		jest.spyOn(Math, "random").mockReturnValue(0.3);

		const { getTwitchClipBatch } = await loadTwitch();
		const fallbackAll = await getTwitchClipBatch("overlay-1", undefined, undefined, ["rand-a", "rand-b", "rand-c"], 999, true);
		const minClamped = await getTwitchClipBatch("overlay-1", undefined, undefined, [], 0, true);

		expect(fallbackAll).toHaveLength(3);
		expect(new Set(fallbackAll.map((clip) => clip.id))).toEqual(new Set(["rand-a", "rand-b", "rand-c"]));
		expect(minClamped).toHaveLength(1);
	});

	it("respects exclusions in smart-shuffle mode and keeps output unique", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "smart_shuffle" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue(
			cacheEntriesFromClips([
				buildClip("smart-a", { view_count: 10, creator_id: "ca", creator_name: "ca", game_id: "ga" }),
				buildClip("smart-b", { view_count: 20, creator_id: "cb", creator_name: "cb", game_id: "gb" }),
				buildClip("smart-c", { view_count: 30, creator_id: "cc", creator_name: "cc", game_id: "gc" }),
				buildClip("smart-d", { view_count: 40, creator_id: "cd", creator_name: "cd", game_id: "gd" }),
			]),
		);
		jest.spyOn(Math, "random").mockReturnValue(0.2);

		const { getTwitchClipBatch } = await loadTwitch();
		const batch = await getTwitchClipBatch("overlay-1", undefined, undefined, ["smart-d"], 3, true);

		expect(batch).toHaveLength(3);
		expect(batch.some((clip) => clip.id === "smart-d")).toBe(false);
		expect(new Set(batch.map((clip) => clip.id)).size).toBe(3);
	});

	it("stops smart-shuffle selection when candidate removal lookup fails", async () => {
		getOverlayPublic.mockResolvedValue(buildOverlay({ playbackMode: "smart_shuffle" }));
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{ key: "clip:owner-1:s1", value: buildClip("s1", { view_count: 15, game_id: "a", creator_id: "ca", creator_name: "ca" }) },
			{ key: "clip:owner-1:s2", value: buildClip("s2", { view_count: 25, game_id: "b", creator_id: "cb", creator_name: "cb" }) },
		]);
		jest.spyOn(Math, "random").mockReturnValue(0.1);
		jest.spyOn(Array.prototype, "findIndex").mockReturnValue(-1);

		const { getTwitchClipBatch } = await loadTwitch();
		const batch = await getTwitchClipBatch("overlay-1", undefined, undefined, [], 5, true);

		expect(batch).toHaveLength(1);
	});

	it("returns null for freshly validated unavailable clips without revalidating immediately", async () => {
		const clip = buildClip("fresh-unavailable");
		getTwitchCache.mockResolvedValue({
			clip,
			unavailable: true,
			lastValidatedAt: new Date().toISOString(),
		});
		const axiosSpy = jest.spyOn(axios, "get");

		const { resolvePlayableClip } = await loadTwitch();
		const resolved = await resolvePlayableClip("owner-1", clip);

		expect(resolved).toBeNull();
		expect(axiosSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("revalidates stale clips and updates cache when clip is still available", async () => {
		const staleClip = buildClip("stale-clip", { title: "Old title" });
		getTwitchCache.mockResolvedValue({
			clip: staleClip,
			lastValidatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [buildClip("stale-clip", { title: "Fresh title" })],
			},
		} as never);

		const { resolvePlayableClip } = await loadTwitch();
		const resolved = await resolvePlayableClip("owner-1", staleClip);

		expect(resolved?.title).toBe("Fresh title");
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip:owner-1:stale-clip",
			expect.objectContaining({
				unavailable: false,
				clip: expect.objectContaining({ id: "stale-clip", title: "Fresh title" }),
			}),
		);
	});

	it("marks stale clips unavailable when Twitch no longer returns them", async () => {
		const staleClip = buildClip("missing-clip");
		getTwitchCache.mockResolvedValue({
			clip: staleClip,
			lastValidatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [],
			},
		} as never);

		const { resolvePlayableClip } = await loadTwitch();
		const resolved = await resolvePlayableClip("owner-1", staleClip);

		expect(resolved).toBeNull();
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip:owner-1:missing-clip",
			expect.objectContaining({
				unavailable: true,
				clip: expect.objectContaining({ id: "missing-clip" }),
			}),
		);
	});

	it("returns fresh cached clip immediately without revalidating", async () => {
		const fallback = buildClip("fresh-cache", { title: "fallback-title" });
		getTwitchCache.mockResolvedValue({
			clip: buildClip("fresh-cache", { title: "cached-title" }),
			lastValidatedAt: new Date().toISOString(),
		});
		const axiosSpy = jest.spyOn(axios, "get");

		const { resolvePlayableClip } = await loadTwitch();
		const resolved = await resolvePlayableClip("owner-1", fallback);

		expect(resolved?.title).toBe("cached-title");
		expect(axiosSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("excludes recently unavailable clips from owner cache until stale", async () => {
		const staleIso = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
		getTwitchCacheByPrefixEntries.mockResolvedValue([
			{
				key: "clip:owner-1:fresh-unavailable",
				value: {
					clip: buildClip("fresh-unavailable"),
					unavailable: true,
					lastValidatedAt: new Date().toISOString(),
				},
			},
			{
				key: "clip:owner-1:stale-unavailable",
				value: {
					clip: buildClip("stale-unavailable"),
					unavailable: true,
					lastValidatedAt: staleIso,
				},
			},
			{
				key: "clip:owner-1:normal-clip",
				value: buildClip("normal-clip"),
			},
			{
				key: "clip:owner-1:normal-clip-dup",
				value: buildClip("normal-clip"),
			},
		]);

		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips(buildOverlay());

		expect(clips.map((clip) => clip.id)).toEqual(["stale-unavailable", "normal-clip"]);
	});

	it("caches new clips from EventSub notifications when clip lookup succeeds", async () => {
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [buildClip("eventsub-clip")],
			},
		} as never);

		const { cacheClipFromEventSub } = await loadTwitch();
		const result = await cacheClipFromEventSub("eventsub-clip", "owner-1");

		expect(result).toBe(true);
		expect(setTwitchCacheBatch).toHaveBeenCalledWith(
			"clip",
			expect.arrayContaining([
				expect.objectContaining({
					key: "clip:owner-1:eventsub-clip",
				}),
			]),
		);
	});

	it("does not cache EventSub clips when lookup fails", async () => {
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [],
			},
		} as never);

		const { cacheClipFromEventSub } = await loadTwitch();
		const result = await cacheClipFromEventSub("missing-clip", "owner-1");

		expect(result).toBe(false);
		expect(setTwitchCacheBatch).not.toHaveBeenCalled();
	});
});
