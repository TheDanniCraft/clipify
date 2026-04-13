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
	},
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
	},
	queueTable: {
		id: "id",
	},
	modQueueTable: {
		id: "id",
	},
	tokenTable: {
		expiresAt: "expiresAt",
	},
	twitchCacheTable: {
		type: "type",
		key: "key",
		value: "value",
		fetchedAt: "fetchedAt",
	},
}));
jest.mock("drizzle-orm", () => ({
	eq: jest.fn(),
	and: jest.fn(),
	gt: jest.fn(),
	sql: Object.assign(jest.fn(() => "sql"), {
		join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
		raw: jest.fn((value: unknown) => String(value)),
	}),
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

		const selectQueue: unknown[][] = [
			[{ count: 10 }], // usersTotal
			[{ count: 20 }], // overlaysTotal
			[{ count: 12 }], // overlaysActive
			[{ count: 8 }], // overlaysPaused
			[{ count: 5 }], // activeUsers24h
			[{ count: 7 }], // activeUsers7d
			[{ count: 9 }], // activeUsers30d
			[{ count: 1 }], // disabledUsers
			[{ count: 1 }], // disabledManual
			[{ count: 0 }], // disabledAutomatic
			[{ count: 1 }], // neverLoggedIn
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
			[{ count: 12 }], // playlistClipRows
			[{ count: 3 }], // nonEmptyPlaylistsRows
			[{ count: 6 }], // overlaysWithPlaylistRows
			[{ count: 4 }], // activeOverlaysWithPlaylistRows
			[{ count: 3 }], // overlaysWithRewardRows
			[{ count: 2 }], // activeOverlaysWithRewardRows
			[{ count: 3 }], // uniqueRewardIdsRows
			[{ count: 2 }], // ownersWithRewardRows
			[{ type: "last_month", count: 2 }], // overlaysByTypeRows
			[{ mode: "random", count: 2 }], // overlaysByPlaybackModeRows
			[{ count: 10 }], // settingsRows
			[{ count: 8 }], // optedInRows
			[{ count: 2 }], // optedOutRows
			[{ source: "soft_opt_in_default", count: 6 }], // newsletterConsentSourceRows
			[{ source: "settings_page_optout", count: 2 }], // optedOutReasonRows
			[{ count: 3 }], // clipQueueRows
			[{ count: 1 }], // modQueueRows
			[{ count: 10 }], // tokenRows
			[{ count: 0 }], // expiredTokensRows
			[{ count: 2 }], // expiringIn24hRows
			[
				{ type: "clip", count: 100 },
				{ type: "avatar", count: 20 },
				{ type: "game", count: 15 },
			], // cacheTotals
			[{ count: 4 }], // unavailableClipsRows
			[{ count: 3 }], // clipSyncStatesRows
			[{ count: 2 }], // clipSyncCompleteRows
			[{ count: 5 }], // staleValidatedRows
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

		expect(snapshot.counts.users).toBe(10);
		expect(snapshot.counts.overlaysTotal).toBe(20);
		expect(snapshot.entitlements.activeGrantUsers).toBe(2);
		expect(snapshot.entitlements.activeGrantUsersOnFree).toBe(1);
		expect(snapshot.cache.entriesTotal).toBe(135);
		expect(snapshot.cache.clipEntries).toBe(100);
		expect(snapshot.cache.backfillCompleteRatio).toBeCloseTo(2 / 3, 1);
		expect(snapshot.scheduler.clipCache.totalRuns).toBe(10);
		expect(snapshot.cache.globalReadHitRate).toBe(0.9);
		expect(snapshot.status).toBe("ok");
		expect(snapshot.db.pingMs).toBeGreaterThanOrEqual(0);
		expect(snapshot.db.healthAggregationMs).toBeGreaterThanOrEqual(snapshot.db.pingMs);
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
			[{ count: 10 }], // usersTotal
			[{ count: 20 }], // overlaysTotal
			[{ count: 12 }], // overlaysActive
			[{ count: 8 }], // overlaysPaused
			[{ count: 5 }], // activeUsers24h
			[{ count: 7 }], // activeUsers7d
			[{ count: 9 }], // activeUsers30d
			[{ count: 1 }], // disabledUsers
			[{ count: 1 }], // disabledManual
			[{ count: 0 }], // disabledAutomatic
			[{ count: 1 }], // neverLoggedIn
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
			[{ count: 12 }], // playlistClipRows
			[{ count: 3 }], // nonEmptyPlaylistsRows
			[{ count: 6 }], // overlaysWithPlaylistRows
			[{ count: 4 }], // activeOverlaysWithPlaylistRows
			[{ count: 3 }], // overlaysWithRewardRows
			[{ count: 2 }], // activeOverlaysWithRewardRows
			[{ count: 3 }], // uniqueRewardIdsRows
			[{ count: 2 }], // ownersWithRewardRows
			[{ type: "last_month", count: 2 }], // overlaysByTypeRows
			[{ mode: "random", count: 2 }], // overlaysByPlaybackModeRows
			[{ count: 10 }], // settingsRows
			[{ count: 8 }], // optedInRows
			[{ count: 2 }], // optedOutRows
			[{ source: "soft_opt_in_default", count: 6 }], // newsletterConsentSourceRows
			[{ source: "settings_page_optout", count: 2 }], // optedOutReasonRows
			[{ count: 3 }], // clipQueueRows
			[{ count: 1 }], // modQueueRows
			[{ count: 10 }], // tokenRows
			[{ count: 0 }], // expiredTokensRows
			[{ count: 2 }], // expiringIn24hRows
			[
				{ type: "clip", count: 100 },
				{ type: "avatar", count: 20 },
				{ type: "game", count: 15 },
			], // cacheTotals
			[{ count: 0 }], // unavailableClipsRows
			[{ count: 0 }], // clipSyncStatesRows
			[{ count: 0 }], // clipSyncCompleteRows
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
			[{ count: 0 }], // usersTotal
			[{ count: 0 }], // overlaysTotal
			[{ count: 0 }], // overlaysActive
			[{ count: 0 }], // overlaysPaused
			[{ count: 0 }], // activeUsers24h
			[{ count: 0 }], // activeUsers7d
			[{ count: 0 }], // activeUsers30d
			[{ count: 0 }], // disabledUsers
			[{ count: 0 }], // disabledManual
			[{ count: 0 }], // disabledAutomatic
			[{ count: 0 }], // neverLoggedIn
			[], // disabledReasonRows
			[], // usersByPlan (empty)
			[], // activeGrants (empty)
			[{ count: 0 }], // activeGrantUsers
			[{ count: 0 }], // activeGrantUsersOnFree
			[], // activeOverlayOwnersByPlanRows (empty)
			[{ count: 0 }], // playlistsTotal
			[{ count: 0 }], // playlistClipRows
			[{ count: 0 }], // nonEmptyPlaylistsRows
			[{ count: 0 }], // overlaysWithPlaylistRows
			[{ count: 0 }], // activeOverlaysWithPlaylistRows
			[{ count: 0 }], // overlaysWithRewardRows
			[{ count: 0 }], // activeOverlaysWithRewardRows
			[{ count: 0 }], // uniqueRewardIdsRows
			[{ count: 0 }], // ownersWithRewardRows
			[], // overlaysByTypeRows
			[], // overlaysByPlaybackModeRows
			[{ count: 0 }], // settingsRows
			[{ count: 0 }], // optedInRows
			[{ count: 0 }], // optedOutRows
			[], // newsletterConsentSourceRows
			[], // optedOutReasonRows
			[{ count: 0 }], // clipQueueRows
			[{ count: 0 }], // modQueueRows
			[{ count: 0 }], // tokenRows
			[{ count: 0 }], // expiredTokensRows
			[{ count: 0 }], // expiringIn24hRows
			[], // cacheTotals (empty)
			[{ count: 0 }], // unavailableClipsRows
			[{ count: 0 }], // clipSyncStatesRows
			[{ count: 0 }], // clipSyncCompleteRows
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
			[], // newsletterConsentSourceRows
			[], // optedOutReasonRows
			[], // clipQueueRows
			[], // modQueueRows
			[], // tokenRows
			[], // expiredTokensRows
			[], // expiringIn24hRows
			[], // cacheTotals
			[], // unavailableClipsRows
			[], // clipSyncStatesRows
			[], // clipSyncCompleteRows
			[], // staleValidatedRows
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		const { getInstanceHealthSnapshot } = await import("@/app/lib/instanceHealth");
		const snapshot = await getInstanceHealthSnapshot();

		expect(snapshot.counts.users).toBe(0);
		expect(snapshot.counts.overlaysTotal).toBe(0);
	});
});
