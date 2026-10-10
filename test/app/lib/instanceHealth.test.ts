/** @jest-environment node */
export {};

const dbSelect = jest.fn();
const dbExecute = jest.fn();
const getTwitchCacheReadMetricsSnapshot = jest.fn();
const getClipCacheSchedulerStats = jest.fn();

jest.mock("@/db/client", () => ({
	db: {
		select: (...args: unknown[]) => dbSelect(...args),
		execute: (...args: unknown[]) => dbExecute(...args),
		transaction: (callback: (transaction: { select: (...args: unknown[]) => unknown; execute: (...args: unknown[]) => unknown }) => unknown) =>
			callback({
				select: (...args: unknown[]) => dbSelect(...args),
				execute: (...args: unknown[]) => dbExecute(...args),
			}),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable: {
		id: "id",
		createdAt: "createdAt",
		plan: "plan",
		lastLogin: "lastLogin",
		disabled: "disabled",
		disableType: "disableType",
		disabledReason: "disabledReason",
	},
	entitlementGrantsTable: {
		source: "source",
		entitlement: "entitlement",
		startsAt: "startsAt",
		endsAt: "endsAt",
		userId: "userId",
		revokedAt: "revokedAt",
	},
	billingSubscriptionsTable: { id: "id", status: "status", cancelAtPeriodEnd: "cancelAtPeriodEnd" },
	billingSubscriptionItemsTable: { subscriptionId: "subscriptionId", productKey: "productKey", unitAmount: "unitAmount", billingInterval: "billingInterval" },
	runnersTable: { id: "id", ownerId: "ownerId", status: "status", osInfo: "osInfo", version: "version" },
	streamSessionsTable: { id: "id", desiredState: "desiredState", actualState: "actualState", lastError: "lastError", mode: "mode", rtmpUrl: "rtmpUrl" },
	overlaysTable: {
		status: "status",
		ownerId: "ownerId",
		playlistId: "playlistId",
		rewardId: "rewardId",
		type: "type",
		playbackMode: "playbackMode",
	},
	playlistsTable: {
		id: "id",
	},
	playlistClipsTable: {
		playlistId: "playlistId",
	},
	settingsTable: {
		marketingOptIn: "marketingOptIn",
		marketingOptInSource: "marketingOptInSource",
		showOnCommunityPage: "showOnCommunityPage",
		creatorPageEnabled: "creatorPageEnabled",
		creatorPageVisibility: "creatorPageVisibility",
		creatorPageShowBio: "creatorPageShowBio",
	},
	galleriesTable: {
		published: "published",
		ownerId: "ownerId",
		source: "source",
		playlistId: "playlistId",
		layout: "layout",
	},
	plausibleStatsCacheTable: {
		expiresAt: "expiresAt",
		lastErrorAt: "lastErrorAt",
	},
	queueTable: {
		id: "id",
	},
	modQueueTable: {
		id: "id",
	},
	twitchCacheTable: {
		type: "type",
		key: "key",
		value: "value",
		fetchedAt: "fetchedAt",
	},
}));
jest.mock("@/db/auth-schema", () => ({
	account: {
		providerId: "providerId",
		accessTokenExpiresAt: "accessTokenExpiresAt",
		scope: "scope",
	},
}));
jest.mock("drizzle-orm", () => ({
	relations: jest.fn(() => ({})),
	eq: jest.fn(),
	and: jest.fn(),
	gt: jest.fn(),
	sql: Object.assign(
		jest.fn(() => "sql"),
		{
			join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
			raw: jest.fn((value: unknown) => String(value)),
		},
	),
	inArray: jest.fn(),
	lte: jest.fn(),
	or: jest.fn(),
	isNull: jest.fn(),
	isNotNull: jest.fn(),
	desc: jest.fn(),
	lt: jest.fn(),
	count: jest.fn(),
	countDistinct: jest.fn(),
	like: jest.fn(),
	notLike: jest.fn(),
	arrayContains: jest.fn(),
}));

jest.mock("@actions/database", () => ({
	getTwitchCacheReadMetricsSnapshot: (...args: unknown[]) => getTwitchCacheReadMetricsSnapshot(...args),
}));

jest.mock("@lib/clipCacheScheduler", () => ({
	getClipCacheSchedulerStats: (...args: unknown[]) => getClipCacheSchedulerStats(...args),
}));

function makeQuery(rows: unknown[]) {
	const query = {
		from: () => query,
		innerJoin: () => query,
		leftJoin: () => query,
		where: () => query,
		groupBy: () => query,
		orderBy: () => query,
		execute: async () => rows,
		then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
	};
	return query;
}

describe("lib/instanceHealth", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		dbExecute.mockResolvedValue([]);
		globalThis.__clipFetchMetrics = undefined;

		const selectQueue: unknown[][] = [
			[{ total: 10, active24h: 5, active7d: 7, active30d: 9, disabled: 1, manual: 1, automatic: 0, neverLoggedIn: 1 }], // combined usersTotal
			[{ total: 20, active: 12, paused: 8, withPlaylist: 6, activeWithPlaylist: 4, withReward: 3, activeWithReward: 2, uniqueRewards: 3, rewardOwners: 2 }], // combined overlaysTotal
			[{ reason: "abuse", count: 1 }], // disabledReasonRows
			[
				{ plan: "free", count: 7 },
				{ plan: "pro", count: 3 },
			], // usersByPlan
			[{ source: "system", entitlement: "pro_access", count: 2 }], // activeGrants
			[{ count: 2 }], // activeGrantUsers
			[{ count: 1 }], // activeGrantUsersOnFree
			[
				{ plan: "free", count: 4 },
				{ plan: "pro", count: 2 },
			], // activeOverlayOwnersByPlanRows
			[{ count: 4 }], // playlistsTotal
			[{ total: 12, nonEmpty: 3 }], // playlistCounts
			[{ type: "last_month", count: 2 }], // overlaysByTypeRows
			[{ mode: "random", count: 2 }], // overlaysByPlaybackModeRows
			[{ total: 10, optedIn: 8, optedOut: 2, community: 3 }], // combined settingsRows
			[{ source: "soft_opt_in_default", count: 6 }], // newsletterConsentSourceRows
			[{ source: "settings_page_optout", count: 2 }], // optedOutReasonRows
			[{ count: 3 }], // clipQueueRows
			[{ count: 1 }], // modQueueRows
			[{ total: 10, expired: 0, expiring: 2, ready: 5 }], // combined tokenRows
			[{ total: 0, online: 0, owners: 0 }],
			[{ total: 0, desiredRunning: 0, actualRunning: 0, errors: 0 }],
			[], // billingItems
			[], // runnersByOsRows
			[], // runnersByVersionRows
			[
				{ mode: "24/7", destination: "youtube", count: 2 },
				{ mode: "failsafe", destination: "twitch", count: 1 },
				{ mode: "failsafe", destination: "custom", count: 3 },
			], // streamsByModeAndDestinationRows
			[
				{ type: "clip", count: 100 },
				{ type: "avatar", count: 20 },
				{ type: "game", count: 15 },
			], // cacheTotals
			[{ count: 4 }], // unavailableClipsRows
			[{ states: 3, complete: 2 }], // clipSyncProgressRows
			[{ count: 5 }], // staleValidatedRows
			[{ total: 4, published: 3, owners: 2, curated: 2, live: 2, orphaned: 0 }], // galleryRows
			[
				{ layout: "grid", count: 2 },
				{ layout: "list", count: 1 },
				{ layout: "carousel", count: 1 },
			], // galleryLayoutRows
			[{ discoverable: 6, unlisted: 2, disabled: 1, showBio: 7 }], // creatorPageRows
			[{ entries: 3, valid: 2, expired: 1, errors: 0 }], // analyticsCacheRows
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		getClipCacheSchedulerStats.mockReturnValue({
			startedAt: "2026-03-01T00:00:00.000Z",
			intervalMs: 60000,
			batchSize: 25,
			lastRunAt: "2026-03-09T00:00:00.000Z",
			lastRunDurationMs: 210,
			lastRunOwnerCount: 4,
			totalRuns: 10,
			totalFailures: 0,
			lastError: null,
		});

		getTwitchCacheReadMetricsSnapshot.mockResolvedValue({
			hits: 90,
			misses: 10,
			staleHits: 2,
			lastReadAt: "2026-03-09T00:10:00.000Z",
			startedAt: "2026-03-01T00:00:00.000Z",
			totalReads: 100,
			hitRate: 0.9,
		});
	});

	it("builds full snapshot from db and scheduler sources", async () => {
		const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.mcp.calls.started_total).toBeGreaterThanOrEqual(0);
		expect(snapshot.mcp.processStartedAt).toEqual(expect.any(String));
		expect(dbSelect).toHaveBeenCalledTimes(32);
		expect(snapshot.counts.users).toBe(10);
		expect(snapshot.counts.overlaysTotal).toBe(20);
		expect(snapshot.entitlements.activeGrantUsers).toBe(2);
		expect(snapshot.entitlements.activeGrantUsersOnFree).toBe(1);
		expect(snapshot.community).toEqual({
			totalUsers: 10,
			optedInUsers: 3,
			optedOutUsers: 7,
			optInRate: 0.3,
		});
		expect(snapshot.cache.entriesTotal).toBe(135);
		expect(snapshot.cache.clipEntries).toBe(100);
		expect(snapshot.cache.backfillCompleteRatio).toBeCloseTo(2 / 3, 1);
		expect(snapshot.scheduler.clipCache.totalRuns).toBe(10);
		expect(snapshot.runners.byMode).toEqual({ "24/7": 2, failsafe: 4 });
		expect(snapshot.runners.byDestination).toEqual({ youtube: 2, twitch: 1, custom: 3 });
		expect(snapshot.runners.byModeAndDestination.failsafe).toEqual({ youtube: 0, twitch: 1, custom: 3 });
		expect(snapshot.cache.globalReadHitRate).toBe(0.9);
		expect(snapshot.status).toBe("ok");
		expect(snapshot.db.pingMs).toBeGreaterThanOrEqual(0);
		expect(snapshot.db.healthAggregationMs).toBeGreaterThanOrEqual(snapshot.db.pingMs);
	});

	it("shares clip fetch metrics with the health snapshot through globalThis", async () => {
		const { getInstanceHealthSnapshot, incrementClipFetchFallback, incrementClipFetchRateLimited, incrementClipFetchV1, incrementClipFetchV2, recordTwitchRateLimit } = await import("@/app/lib/instanceHealth");
		incrementClipFetchV1();
		incrementClipFetchV2();
		incrementClipFetchV2();
		incrementClipFetchFallback();
		incrementClipFetchRateLimited();
		recordTwitchRateLimit({
			broadcasterId: "owner-1",
			clipId: "clip-1",
			limit: "100",
			remaining: "99",
			reset: "123",
			timestamp: "2026-03-09T00:00:00.000Z",
		});

		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.clips.fetches).toEqual({
			v1GraphQL: 1,
			v2TwitchApi: 2,
			v2FallbackGraphQL: 1,
			v2RateLimited: 1,
		});
		expect(snapshot.twitchRateLimit.history).toHaveLength(1);
	});

	it("returns degraded status when scheduler failure ratio is high", async () => {
		getClipCacheSchedulerStats.mockReturnValue({
			startedAt: "2026-03-01T00:00:00.000Z",
			intervalMs: 60000,
			batchSize: 25,
			lastRunAt: "2026-03-09T00:00:00.000Z",
			lastRunDurationMs: 210,
			lastRunOwnerCount: 4,
			totalRuns: 10,
			totalFailures: 2,
			lastError: null,
		});

		const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.status).toBe("degraded");
	});

	it("returns down status for very high db latency and handles zero sync ratio", async () => {
		const selectQueue: unknown[][] = [
			[{ total: 10, active24h: 5, active7d: 7, active30d: 9, disabled: 1, manual: 1, automatic: 0, neverLoggedIn: 1 }], // combined usersTotal
			[{ total: 20, active: 12, paused: 8, withPlaylist: 6, activeWithPlaylist: 4, withReward: 3, activeWithReward: 2, uniqueRewards: 3, rewardOwners: 2 }], // combined overlaysTotal
			[{ reason: "abuse", count: 1 }], // disabledReasonRows
			[
				{ plan: "free", count: 7 },
				{ plan: "pro", count: 3 },
			], // usersByPlan
			[{ source: "system", entitlement: "pro_access", count: 2 }], // activeGrants
			[{ count: 2 }], // activeGrantUsers
			[{ count: 1 }], // activeGrantUsersOnFree
			[
				{ plan: "free", count: 4 },
				{ plan: "pro", count: 2 },
			], // activeOverlayOwnersByPlanRows
			[{ count: 4 }], // playlistsTotal
			[{ total: 12, nonEmpty: 3 }], // playlistCounts
			[{ type: "last_month", count: 2 }], // overlaysByTypeRows
			[{ mode: "random", count: 2 }], // overlaysByPlaybackModeRows
			[{ total: 10, optedIn: 8, optedOut: 2, community: 3 }], // combined settingsRows
			[{ source: "soft_opt_in_default", count: 6 }], // newsletterConsentSourceRows
			[{ source: "settings_page_optout", count: 2 }], // optedOutReasonRows
			[{ count: 3 }], // clipQueueRows
			[{ count: 1 }], // modQueueRows
			[{ total: 10, expired: 0, expiring: 2 }], // combined tokenRows
			[
				{ type: "clip", count: 100 },
				{ type: "avatar", count: 20 },
				{ type: "game", count: 15 },
			], // cacheTotals
			[{ count: 0 }], // unavailableClipsRows
			[{ states: 0, complete: 0 }], // clipSyncProgressRows
			[{ count: 4 }], // staleValidatedRows
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		const dateNowSpy = jest.spyOn(Date, "now");
		dateNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(6001);

		try {
			const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
			const snapshot = await getInstanceHealthSnapshot();

			expect(snapshot.status).toBe("down");
			expect(snapshot.cache.clipSyncStates).toBe(0);
			expect(snapshot.cache.backfillCompleteRatio).toBe(0);
		} finally {
			dateNowSpy.mockRestore();
		}
	});

	it("returns degraded status for medium db latency", async () => {
		const dateNowSpy = jest.spyOn(Date, "now");
		dateNowSpy.mockReturnValueOnce(0).mockReturnValue(2500);

		try {
			const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
			const snapshot = await getInstanceHealthSnapshot();
			expect(snapshot.status).toBe("degraded");
		} finally {
			dateNowSpy.mockRestore();
		}
	});

	it("uses environment variables for app info", async () => {
		const originalEnv = process.env;
		process.env = {
			...originalEnv,
			NODE_ENV: "production",
			VERCEL_GIT_COMMIT_SHA: "vercel123",
		};

		try {
			const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
			const snapshot = await getInstanceHealthSnapshot();
			expect(snapshot.app.env).toBe("production");
			expect(snapshot.app.version).toBe("vercel123");
		} finally {
			process.env = originalEnv;
		}
	});

	it("falls back to RAILWAY_GIT_COMMIT_SHA when VERCEL is missing", async () => {
		const originalEnv = process.env;
		process.env = {
			...originalEnv,
			NODE_ENV: "test",
			VERCEL_GIT_COMMIT_SHA: undefined,
			RAILWAY_GIT_COMMIT_SHA: "railway456",
		};

		try {
			const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
			const snapshot = await getInstanceHealthSnapshot();
			expect(snapshot.app.env).toBe("test");
			expect(snapshot.app.version).toBe("railway456");
		} finally {
			process.env = originalEnv;
		}
	});

	it("handles empty or missing data in various plan and cache searches", async () => {
		const selectQueue: unknown[][] = [
			[{ total: 0, active24h: 0, active7d: 0, active30d: 0, disabled: 0, manual: 0, automatic: 0, neverLoggedIn: 0 }], // combined usersTotal
			[{ total: 0, active: 0, paused: 0, withPlaylist: 0, activeWithPlaylist: 0, withReward: 0, activeWithReward: 0, uniqueRewards: 0, rewardOwners: 0 }], // combined overlaysTotal
			[], // disabledReasonRows
			[], // usersByPlan (empty)
			[], // activeGrants (empty)
			[{ count: 0 }], // activeGrantUsers
			[{ count: 0 }], // activeGrantUsersOnFree
			[], // activeOverlayOwnersByPlanRows (empty)
			[{ count: 0 }], // playlistsTotal
			[{ total: 0, nonEmpty: 0 }], // playlistCounts
			[], // overlaysByTypeRows
			[], // overlaysByPlaybackModeRows
			[{ total: 0, optedIn: 0, optedOut: 0, community: 0 }], // combined settingsRows
			[], // newsletterConsentSourceRows
			[], // optedOutReasonRows
			[{ count: 0 }], // clipQueueRows
			[{ count: 0 }], // modQueueRows
			[{ total: 0, expired: 0, expiring: 0 }], // combined tokenRows
			[], // cacheTotals (empty)
			[{ count: 0 }], // unavailableClipsRows
			[{ states: 0, complete: 0 }], // clipSyncProgressRows
			[{ count: 0 }], // staleValidatedRows
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.counts.usersFree).toBe(0);
		expect(snapshot.counts.usersPaid).toBe(0);
		expect(snapshot.cache.clipEntries).toBe(0);
		expect(snapshot.cache.entriesTotal).toBe(0);
		expect(snapshot.entitlements.activeGrantCount).toBe(0);
		expect(snapshot.community).toEqual({ totalUsers: 0, optedInUsers: 0, optedOutUsers: 0, optInRate: 0 });
		expect(snapshot.status).toBe("ok");
	});

	it("handles missing rows in count queries (?? 0 coverage)", async () => {
		const selectQueue: unknown[][] = [
			[], // usersTotal
			[], // overlaysTotal
			[], // overlaysActive
			[], // overlaysPaused
			[], // activeUsers24h
			[], // activeUsers7d
			[], // activeUsers30d
			[], // disabledUsers
			[], // disabledManual
			[], // disabledAutomatic
			[], // neverLoggedIn
			[], // disabledReasonRows
			[], // usersByPlan
			[], // activeGrants
			[], // activeGrantUsers
			[], // activeGrantUsersOnFree
			[], // activeOverlayOwnersByPlanRows
			[], // playlistsTotal
			[], // playlistClipRows
			[], // nonEmptyPlaylistsRows
			[], // overlaysWithPlaylistRows
			[], // activeOverlaysWithPlaylistRows
			[], // overlaysWithRewardRows
			[], // activeOverlaysWithRewardRows
			[], // uniqueRewardIdsRows
			[], // ownersWithRewardRows
			[], // overlaysByTypeRows
			[], // overlaysByPlaybackModeRows
			[], // settingsRows
			[], // optedInRows
			[], // optedOutRows
			[], // communityOptedInRows
			[], // newsletterConsentSourceRows
			[], // optedOutReasonRows
			[], // clipQueueRows
			[], // modQueueRows
			[], // tokenRows
			[], // expiredTokensRows
			[], // expiringIn24hRows
			[], // readyForTwitchApiUsersRows
			[], // cacheTotals
			[], // unavailableClipsRows
			[], // clipSyncProgressRows
			[], // staleValidatedRows
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.counts.users).toBe(0);
		expect(snapshot.counts.overlaysTotal).toBe(0);
	});
});
