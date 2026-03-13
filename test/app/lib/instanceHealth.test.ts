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
	sql: jest.fn(),
	inArray: jest.fn(),
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
		where: () => query,
		groupBy: () => query,
		execute: async () => rows,
		then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
	};
	return query;
}

describe("lib/instanceHealth", () => {
	beforeEach(() => {
		jest.clearAllMocks();

		const selectQueue: unknown[][] = [
			[{ count: 10 }],
			[{ count: 20 }],
			[{ count: 12 }],
			[{ count: 8 }],
			[{ count: 5 }],
			[{ count: 7 }],
			[{ count: 9 }],
			[
				{ plan: "free", count: 7 },
				{ plan: "pro", count: 3 },
			],
			[{ source: "system", entitlement: "pro_access", count: 2 }],
			[
				{ type: "clip", count: 100 },
				{ type: "avatar", count: 20 },
				{ type: "game", count: 15 },
			],
		];
		dbSelect.mockImplementation(() => makeQuery(selectQueue.shift() ?? []));

		const executeQueue: unknown[] = [
			{ rows: [{ count: 2 }] }, // activeGrantUsers
			{ rows: [{ count: 1 }] }, // activeGrantUsersOnFree
			{
				rows: [
					{ plan: "free", count: 4 },
					{ plan: "pro", count: 2 },
				],
			}, // activeOverlayOwnersByPlan
			{ rows: [{ count: 4 }] }, // unavailableClips
			{
				rows: [
					{ key: "clip-sync:owner-1", value: JSON.stringify({ backfillComplete: true }) },
					{ key: "clip-sync:owner-2", value: JSON.stringify({ backfillComplete: true }) },
					{ key: "clip-sync:owner-3", value: JSON.stringify({ backfillComplete: false, backfillWindowEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }) },
				],
			}, // clipSyncStates
			{ rows: [{ count: 5 }] }, // staleValidatedClips
		];
		dbExecute.mockImplementation(async () => executeQueue.shift() ?? { rows: [] });

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
		dbExecute.mockImplementationOnce(async () => ({ rows: [{ count: 2 }] })); // activeGrantUsers
		dbExecute.mockImplementationOnce(async () => ({ rows: [{ count: 1 }] })); // activeGrantUsersOnFree
		dbExecute.mockImplementationOnce(async () => ({
			rows: [
				{ plan: "free", count: 4 },
				{ plan: "pro", count: 2 },
			],
		})); // activeOverlayOwnersByPlan
		dbExecute.mockImplementationOnce(async () => ({ rows: [{ count: 0 }] })); // unavailableClips
		dbExecute.mockImplementationOnce(async () => ({ rows: [] })); // clipSyncStates
		dbExecute.mockImplementationOnce(async () => ({ rows: [{ count: 4 }] })); // staleValidatedClips

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
});
