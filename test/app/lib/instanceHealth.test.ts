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
	},
	twitchCacheTable: {
		type: "type",
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

		const selectQueue: unknown[][] = [
			[{ count: 10 }], // usersTotal
			[{ count: 20 }], // overlaysTotal
			[{ count: 12 }], // overlaysActive
			[{ count: 8 }], // overlaysPaused
			[{ count: 5 }], // activeUsers24h
			[{ count: 7 }], // activeUsers7d
			[{ count: 9 }], // activeUsers30d
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
		expect(snapshot.db.latencyMs).toBeGreaterThanOrEqual(0);
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
			[], // usersByPlan (empty)
			[], // activeGrants (empty)
			[{ count: 0 }], // activeGrantUsers
			[{ count: 0 }], // activeGrantUsersOnFree
			[], // activeOverlayOwnersByPlanRows (empty)
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
			[], // usersByPlan
			[], // activeGrants
			[], // activeGrantUsers
			[], // activeGrantUsersOnFree
			[], // activeOverlayOwnersByPlanRows
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
