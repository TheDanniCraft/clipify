/** @jest-environment node */
export {};

import axios from "axios";
import { TwitchCacheType } from "@types";

const deleteTwitchCacheByPrefix = jest.fn();
const deleteTwitchCacheKeys = jest.fn();
const getAccessToken = jest.fn();
const getTwitchCache = jest.fn();
const getTwitchCacheByPrefixEntries = jest.fn();
const setTwitchCache = jest.fn();
const setTwitchCacheBatch = jest.fn();
const validateAuth = jest.fn();

const connect = jest.fn();

jest.mock("@actions/database", () => ({
	deleteTwitchCacheByPrefix: (...args: unknown[]) => deleteTwitchCacheByPrefix(...args),
	deleteTwitchCacheKeys: (...args: unknown[]) => deleteTwitchCacheKeys(...args),
	getAccessToken: (...args: unknown[]) => getAccessToken(...args),
	getOverlayBySecret: jest.fn(),
	getOverlayPublic: jest.fn(),
	getTwitchCache: (...args: unknown[]) => getTwitchCache(...args),
	getTwitchCacheBatch: jest.fn(),
	getTwitchCacheByPrefixEntries: (...args: unknown[]) => getTwitchCacheByPrefixEntries(...args),
	getTwitchCacheEntry: jest.fn(),
	getTwitchCacheStale: jest.fn(),
	getTwitchCacheStaleBatch: jest.fn(),
	setTwitchCache: (...args: unknown[]) => setTwitchCache(...args),
	setTwitchCacheBatch: (...args: unknown[]) => setTwitchCacheBatch(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@/db/client", () => ({
	dbPool: {
		connect: (...args: unknown[]) => connect(...args),
	},
}));

function buildClip(id: string) {
	return {
		id,
		url: `https://clips.twitch.tv/${id}`,
		embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
		broadcaster_id: "owner-1",
		broadcaster_name: "owner",
		creator_id: "creator-1",
		creator_name: "creator",
		video_id: "video-1",
		game_id: "game-1",
		language: "en",
		title: `clip-${id}`,
		view_count: 1,
		created_at: "2026-01-01T00:00:00.000Z",
		thumbnail_url: "https://thumb",
		duration: 30,
	};
}

function createCacheEntry(id: string) {
	return {
		key: `clip:owner-1:${id}`,
		value: buildClip(id),
	};
}

function createLockClient(locked: boolean) {
	return {
		query: jest.fn().mockResolvedValue({ rows: [{ locked }] }),
		release: jest.fn(),
	};
}

describe("actions/twitch syncOwnerClipCache", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		connect.mockResolvedValue(createLockClient(true));
		getAccessToken.mockResolvedValue({ accessToken: "token" });
		getTwitchCache.mockResolvedValue({});
		getTwitchCacheByPrefixEntries.mockResolvedValue([]);
		validateAuth.mockResolvedValue(null);
	});

	it("runs incremental and backfill sync and persists state", async () => {
		getTwitchCache.mockResolvedValue({});
		jest.spyOn(axios, "get")
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-1")],
					pagination: { cursor: "cursor-1" },
				},
			} as never)
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-2")],
					pagination: {},
				},
			} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(setTwitchCacheBatch).toHaveBeenCalledTimes(2);
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillComplete: true,
			}),
		);
	});

	it("returns early when owner lock cannot be acquired", async () => {
		const lockClient = createLockClient(false);
		connect.mockResolvedValue(lockClient);
		const axiosSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getAccessToken).not.toHaveBeenCalled();
		expect(axiosSpy).not.toHaveBeenCalled();
		expect(setTwitchCacheBatch).not.toHaveBeenCalled();
		expect(lockClient.release).toHaveBeenCalled();
	});

	it("returns early when no access token is available", async () => {
		getAccessToken.mockResolvedValue(null);
		const axiosSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(axiosSpy).not.toHaveBeenCalled();
		expect(setTwitchCacheBatch).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("sizes incremental fetch to ensure clip pack deficit", async () => {
		getTwitchCache.mockResolvedValue({});
		getTwitchCacheByPrefixEntries.mockResolvedValue(Array.from({ length: 20 }, (_, idx) => createCacheEntry(`existing-${idx}`)));
		const getSpy = jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [buildClip("fetched")],
				pagination: {},
			},
		} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1", 25);

		expect(getSpy).toHaveBeenCalledTimes(1);
		expect(getSpy.mock.calls[0]?.[1]?.params?.first).toBe(5);
		expect(setTwitchCacheBatch).toHaveBeenCalledWith(
			"clip",
			expect.arrayContaining([
				expect.objectContaining({
					key: "clip:owner-1:fetched",
				}),
			]),
		);
	});

	it("skips sync work when incremental and backfill are not due", async () => {
		const nowIso = new Date().toISOString();
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: nowIso,
			lastBackfillSyncAt: nowIso,
			backfillCursor: "cursor-present",
			backfillComplete: true,
		});
		const getSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getSpy).not.toHaveBeenCalled();
		expect(setTwitchCacheBatch).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("continues with backfill when incremental fetch fails", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: "2000-01-01T00:00:00.000Z",
			backfillCursor: "existing-cursor",
			backfillComplete: false,
		});
		jest.spyOn(axios, "get")
			.mockRejectedValueOnce(new Error("incremental failed"))
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("backfill-ok")],
					pagination: {},
				},
			} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(setTwitchCacheBatch).toHaveBeenCalledTimes(1);
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillComplete: true,
				backfillCursor: undefined,
			}),
		);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("handles complete Twitch API outage without throwing", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: "2000-01-01T00:00:00.000Z",
			lastBackfillSyncAt: "2000-01-01T00:00:00.000Z",
			backfillCursor: "outage-cursor",
			backfillComplete: false,
		});
		jest.spyOn(axios, "get").mockRejectedValue(new Error("twitch outage"));

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await expect(syncOwnerClipCache("owner-1")).resolves.toBeUndefined();

		expect(setTwitchCacheBatch).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("does not overwrite in-progress backfill cursor with new incremental cursor", async () => {
		getTwitchCache.mockResolvedValue({
			backfillCursor: "existing-cursor",
			backfillComplete: false,
			lastIncrementalSyncAt: "2026-01-01T00:00:00.000Z",
		});
		jest.spyOn(axios, "get")
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-3")],
					pagination: { cursor: "new-cursor" },
				},
			} as never)
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-4")],
					pagination: {},
				},
			} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect((axios.get as jest.Mock).mock.calls[1]?.[1]?.params?.after).toBe("existing-cursor");
	});

	it("blocks force refresh during cooldown", async () => {
		validateAuth.mockResolvedValue({ id: "owner-1" } as never);
		getTwitchCache.mockImplementation((cacheType: TwitchCacheType, key: string) => {
			if (cacheType === TwitchCacheType.Clip && key === "clip-sync-force:owner-1") {
				return Promise.resolve({ lastForcedAt: new Date().toISOString() });
			}
			return Promise.resolve({});
		});

		const { forceRefreshOwnClipCache } = await import("@/app/actions/twitch");
		const result = await forceRefreshOwnClipCache(50);

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				reason: "cooldown",
			}),
		);
		expect(deleteTwitchCacheByPrefix).not.toHaveBeenCalled();
		expect(deleteTwitchCacheKeys).not.toHaveBeenCalled();
	});

	it("forces clip cache refresh and records cooldown timestamp", async () => {
		validateAuth.mockResolvedValue({ id: "owner-1" } as never);
		getTwitchCache.mockImplementation((cacheType: TwitchCacheType, key: string) => {
			if (cacheType === TwitchCacheType.Clip && key === "clip-sync-force:owner-1") {
				return Promise.resolve({});
			}
			if (cacheType === TwitchCacheType.Clip && key === "clip-sync:owner-1") {
				return Promise.resolve({});
			}
			return Promise.resolve({});
		});
		connect.mockResolvedValue(createLockClient(false));

		const { forceRefreshOwnClipCache } = await import("@/app/actions/twitch");
		const result = await forceRefreshOwnClipCache(80);
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(result).toEqual(
			expect.objectContaining({
				ok: true,
				cooldownMs: expect.any(Number),
			}),
		);
		expect(deleteTwitchCacheByPrefix).toHaveBeenCalledWith("clip", "clip:owner-1:");
		expect(deleteTwitchCacheKeys).toHaveBeenCalledWith("clip", ["clip-sync:owner-1"]);
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync-force:owner-1",
			expect.objectContaining({
				lastForcedAt: expect.any(String),
			}),
		);
	});

	it("returns success on force refresh even when background sync fails", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		validateAuth.mockResolvedValue({ id: "owner-1" } as never);
		getTwitchCache.mockResolvedValue({});
		connect.mockRejectedValue(new Error("db unavailable"));

		const { forceRefreshOwnClipCache } = await import("@/app/actions/twitch");
		const result = await forceRefreshOwnClipCache(30);
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(result).toEqual(
			expect.objectContaining({
				ok: true,
				cooldownMs: expect.any(Number),
			}),
		);
		expect(consoleSpy).toHaveBeenCalled();
	});
});
