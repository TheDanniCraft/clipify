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
	db: {
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		execute: jest.fn().mockResolvedValue([{ createdAt: new Date("2020-01-01T00:00:00Z").toISOString() }]),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable: {
		id: "id",
		createdAt: "createdAt",
	},
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(),
	inArray: jest.fn(),
	sql: jest.fn(),
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

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("runs incremental and backfill sync and persists state", async () => {
		const TWITCH_CLIPS_LAUNCH_MS = new Date("2016-05-01T00:00:00Z").getTime();
		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: new Date(TWITCH_CLIPS_LAUNCH_MS + 24 * 60 * 60 * 1000).toISOString(),
			backfillWindowSizeMs: 7 * 24 * 60 * 60 * 1000,
		});
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
					pagination: { cursor: "cursor-2" },
				},
			} as never)
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-3")],
					pagination: {},
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

		// Incremental (3 pages: until cursor null) + Backfill (1 page completes because we force at least one iteration)
		expect(axios.get).toHaveBeenCalledTimes(4);
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillComplete: true,
				backfillWindowEnd: expect.any(String),
				backfillWindowSizeMs: expect.any(Number),
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
		expect(lockClient.release).toHaveBeenCalled();
	});

	it("returns early when no access token is available", async () => {
		getAccessToken.mockResolvedValue(null);
		const axiosSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(axiosSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("skips all sync work while owner is rate-limited", async () => {
		getTwitchCache.mockResolvedValue({
			rateLimitedUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
			lastIncrementalSyncAt: "2000-01-01T00:00:00.000Z",
			lastBackfillSyncAt: "2000-01-01T00:00:00.000Z",
			backfillComplete: false,
		});
		const getSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("clears expired rate-limit state even when no sync is due", async () => {
		const nowIso = new Date().toISOString();
		getTwitchCache.mockResolvedValue({
			rateLimitedUntil: "2000-01-01T00:00:00.000Z",
			lastIncrementalSyncAt: nowIso,
			lastBackfillSyncAt: nowIso,
			backfillComplete: true,
		});
		const getSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				rateLimitedUntil: undefined,
			}),
		);
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

		// Incremental fetch uses deficit (5) then backfill loop exhausts budget or completes
		expect(getSpy).toHaveBeenCalled();
		expect(getSpy.mock.calls[0]?.[1]?.params?.first).toBe(5);
	});

	it("skips sync work when incremental and backfill are not due", async () => {
		const nowIso = new Date().toISOString();
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: nowIso,
			lastBackfillSyncAt: nowIso,
			backfillComplete: true,
		});
		const getSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).not.toHaveBeenCalled();
	});

	it("continues with backfill when incremental fetch fails", async () => {
		const TWITCH_CLIPS_LAUNCH_MS = new Date("2016-05-01T00:00:00Z").getTime();
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: "2000-01-01T00:00:00.000Z",
			backfillWindowEnd: new Date(TWITCH_CLIPS_LAUNCH_MS + 24 * 60 * 60 * 1000).toISOString(),
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

		// Incremental failed, but backfill continues because it's in a separate try/catch block now
		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillComplete: true,
			}),
		);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("handles complete Twitch API outage without throwing", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		getTwitchCache.mockResolvedValue({
			lastIncrementalSyncAt: "2000-01-01T00:00:00.000Z",
			lastBackfillSyncAt: "2000-01-01T00:00:00.000Z",
			backfillComplete: false,
		});
		jest.spyOn(axios, "get").mockRejectedValue(new Error("twitch outage"));

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await expect(syncOwnerClipCache("owner-1")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("backfill uses time windows and correctly advances", async () => {
		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: "2026-03-01T00:00:00.000Z",
			backfillComplete: false,
			lastIncrementalSyncAt: new Date().toISOString(),
		});
		jest.spyOn(axios, "get")
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-backfill-1")],
					pagination: { cursor: "window-cursor" },
				},
			} as never)
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("clip-backfill-2")],
					pagination: {},
				},
			} as never)
			.mockResolvedValue({
				data: {
					data: [],
					pagination: {},
				},
			} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect((axios.get as jest.Mock).mock.calls).toEqual(
			expect.arrayContaining([
				expect.arrayContaining([
					expect.any(String),
					expect.objectContaining({
						params: expect.objectContaining({
							started_at: expect.any(String),
							ended_at: "2026-03-01T00:00:00.000Z",
						}),
					}),
				]),
			]),
		);

		expect(setTwitchCache).toHaveBeenCalledWith(
			"clip",
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillWindowEnd: expect.any(String),
			}),
		);
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

	it("persists partial backfill results and cursor on 429 rate limit error", async () => {
		const now = Date.now();
		const windowEnd = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: windowEnd,
			backfillComplete: false,
			lastIncrementalSyncAt: new Date(now).toISOString(),
		});

		const page1 = {
			data: {
				data: [buildClip("partial-1")],
				pagination: { cursor: "cursor-after-page-1" },
			},
		};

		const error429 = {
			isAxiosError: true,
			response: {
				status: 429,
				headers: { "retry-after": "60" },
			},
		};

		jest.spyOn(axios, "get").mockResolvedValueOnce(page1 as never).mockRejectedValueOnce(error429);
		// Mock axios.isAxiosError
		jest.spyOn(axios, "isAxiosError").mockImplementation((e) => e === error429);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		// The error is swallowed in the backfill loop catch, so it resolves
		await syncOwnerClipCache("owner-1");

		// Should have persisted the first page
		expect(setTwitchCacheBatch).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			expect.arrayContaining([
				expect.objectContaining({
					key: "clip:owner-1:partial-1",
				}),
			]),
		);

		// Should have updated sync state with the cursor and rate limit
		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillCursor: "cursor-after-page-1",
				rateLimitedUntil: expect.any(String),
			}),
		);
	});

	it("stores window context when first backfill window is rate-limited", async () => {
		const now = Date.now();
		getTwitchCache.mockResolvedValue({
			backfillComplete: false,
			lastIncrementalSyncAt: new Date(now).toISOString(),
		});

		const page1 = {
			data: {
				data: [buildClip("partial-initial-window")],
				pagination: { cursor: "cursor-initial-window" },
			},
		};
		const error429 = {
			isAxiosError: true,
			response: {
				status: 429,
				headers: { "retry-after": "60" },
			},
		};
		jest.spyOn(axios, "get").mockResolvedValueOnce(page1 as never).mockRejectedValueOnce(error429);
		jest.spyOn(axios, "isAxiosError").mockImplementation((e) => e === error429);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillCursor: "cursor-initial-window",
				backfillWindowEnd: expect.any(String),
				rateLimitedUntil: expect.any(String),
			}),
		);
	});

	it("persists partial results and maintains cursor when request budget is exhausted", async () => {
		const now = Date.now();
		const windowEnd = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

		// Use isolateModulesAsync to ensure fresh module state for environment variable change.
		await jest.isolateModulesAsync(async () => {
			process.env.CLIP_SYNC_REQUEST_BUDGET_PER_RUN = "1";
			try {
				const isolatedAxios = (await import("axios")).default;
				const { syncOwnerClipCache } = await import("@/app/actions/twitch");

				getTwitchCache.mockResolvedValue({
					backfillWindowEnd: windowEnd,
					backfillComplete: false,
					lastIncrementalSyncAt: new Date(now).toISOString(),
				});

				const page1 = {
					data: {
						data: [buildClip("budget-1")],
						pagination: { cursor: "cursor-mid-window" },
					},
				};

				jest.spyOn(isolatedAxios, "get").mockResolvedValueOnce(page1 as never);

				await syncOwnerClipCache("owner-1");

				// Should have persisted the first page
				expect(setTwitchCacheBatch).toHaveBeenCalledWith(
					TwitchCacheType.Clip,
					expect.arrayContaining([
						expect.objectContaining({
							key: "clip:owner-1:budget-1",
						}),
					]),
				);

				// Should NOT have advanced windowEnd, but SHOULD have saved the cursor
				expect(setTwitchCache).toHaveBeenCalledWith(
					TwitchCacheType.Clip,
					"clip-sync:owner-1",
					expect.objectContaining({
						backfillWindowEnd: windowEnd, // Same as before
						backfillCursor: "cursor-mid-window",
					}),
				);
			} finally {
				delete process.env.CLIP_SYNC_REQUEST_BUDGET_PER_RUN;
			}
		});
	});

	it("stores window context when request budget is exhausted in initial window", async () => {
		const now = Date.now();

		await jest.isolateModulesAsync(async () => {
			process.env.CLIP_SYNC_REQUEST_BUDGET_PER_RUN = "1";
			try {
				const isolatedAxios = (await import("axios")).default;
				const { syncOwnerClipCache } = await import("@/app/actions/twitch");

				getTwitchCache.mockResolvedValue({
					backfillComplete: false,
					lastIncrementalSyncAt: new Date(now).toISOString(),
				});

				jest.spyOn(isolatedAxios, "get").mockResolvedValueOnce({
					data: {
						data: [buildClip("budget-initial-window")],
						pagination: { cursor: "cursor-budget-initial" },
					},
				} as never);

				await syncOwnerClipCache("owner-1");

				expect(setTwitchCache).toHaveBeenCalledWith(
					TwitchCacheType.Clip,
					"clip-sync:owner-1",
					expect.objectContaining({
						backfillCursor: "cursor-budget-initial",
						backfillWindowEnd: expect.any(String),
					}),
				);
			} finally {
				delete process.env.CLIP_SYNC_REQUEST_BUDGET_PER_RUN;
			}
		});
	});

	it("does not advance to next window when a window fails after partial progress", async () => {
		const windowEnd = "2026-03-01T00:00:00.000Z";
		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: windowEnd,
			backfillComplete: false,
			lastIncrementalSyncAt: new Date().toISOString(),
		});

		const transientError = new Error("transient twitch error");
		jest.spyOn(axios, "get")
			.mockResolvedValueOnce({
				data: {
					data: [buildClip("partial-window-clip")],
					pagination: { cursor: "cursor-after-partial" },
				},
			} as never)
			.mockRejectedValueOnce(transientError);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillWindowEnd: windowEnd,
				backfillCursor: "cursor-after-partial",
			}),
		);
	});

	it("resets legacy backfill cursor to avoid invalid query errors", async () => {
		getTwitchCache.mockResolvedValue({
			backfillCursor: "legacy-cursor",
			backfillWindowEnd: undefined, // Missing window state indicates legacy
			backfillComplete: false,
			lastIncrementalSyncAt: new Date().toISOString(),
		});

		jest.spyOn(axios, "get").mockResolvedValue({
			data: { data: [], pagination: {} },
		} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		// First call should NOT use the legacy cursor
		expect(axios.get).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				params: expect.objectContaining({
					after: undefined,
				}),
			}),
		);
	});

	it("marks backfill complete when stored window end is invalid", async () => {
		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: "not-a-date",
			backfillComplete: false,
			lastIncrementalSyncAt: new Date().toISOString(),
		});
		const getSpy = jest.spyOn(axios, "get");

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(getSpy).not.toHaveBeenCalled();
		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillComplete: true,
				lastBackfillSyncAt: expect.any(String),
			}),
		);
	});

	it("resets cursor when shrinking window size due to high clip density", async () => {
		const now = Date.now();
		getTwitchCache.mockResolvedValue({
			backfillWindowEnd: new Date(now).toISOString(),
			backfillWindowSizeMs: 24 * 60 * 60 * 1000, // 1 day
			backfillComplete: false,
			lastIncrementalSyncAt: new Date(now).toISOString(),
		});

		// Mock a response that triggers hitLimitInWindow (e.g., 10 pages)
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: Array.from({ length: 100 }, (_, i) => buildClip(`dense-${i}`)),
				pagination: { cursor: "dense-cursor" },
			},
		} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		// Should have shrunk the window and RESET the cursor
		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillWindowSizeMs: 12 * 60 * 60 * 1000, // Halved
				backfillCursor: undefined, // RESET
			}),
		);
	});

	it("preserves initial window context when shrinking dense backfill window", async () => {
		getTwitchCache.mockResolvedValue({
			backfillComplete: false,
			lastIncrementalSyncAt: new Date().toISOString(),
		});

		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: Array.from({ length: 100 }, (_, i) => buildClip(`dense-initial-${i}`)),
				pagination: { cursor: "dense-initial-cursor" },
			},
		} as never);

		const { syncOwnerClipCache } = await import("@/app/actions/twitch");
		await syncOwnerClipCache("owner-1");

		expect(setTwitchCache).toHaveBeenCalledWith(
			TwitchCacheType.Clip,
			"clip-sync:owner-1",
			expect.objectContaining({
				backfillWindowSizeMs: expect.any(Number),
				backfillWindowEnd: expect.any(String),
				backfillCursor: undefined,
			}),
		);
	});
});
