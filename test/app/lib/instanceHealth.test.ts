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
			{ rows: [{ count: 2 }] },
			{ rows: [{ count: 1 }] },
			{
				rows: [
					{ plan: "free", count: 4 },
					{ plan: "pro", count: 2 },
				],
			},
			{ rows: [{ count: 11 }] },
			{ rows: [{ count: 3 }] },
			{ rows: [{ count: 2 }] },
			{ rows: [{ count: 4 }] },
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
		expect(snapshot.cache.backfillCompleteRatio).toBeCloseTo(2 / 3, 5);
		expect(snapshot.scheduler.clipCache.totalRuns).toBe(10);
		expect(snapshot.cache.globalReadHitRate).toBe(0.9);
		expect(snapshot.status).toBe("ok");
		expect(snapshot.db.latencyMs).toBeGreaterThanOrEqual(0);
	});
});
