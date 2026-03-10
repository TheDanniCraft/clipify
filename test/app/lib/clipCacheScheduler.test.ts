/** @jest-environment node */

const getActiveOverlayOwnerIdsForClipSync = jest.fn();
const syncOwnerClipCache = jest.fn();
const connect = jest.fn();

jest.mock("@actions/database", () => ({
	getActiveOverlayOwnerIdsForClipSync: (...args: unknown[]) => getActiveOverlayOwnerIdsForClipSync(...args),
}));

jest.mock("@actions/twitch", () => ({
	syncOwnerClipCache: (...args: unknown[]) => syncOwnerClipCache(...args),
}));

jest.mock("@/db/client", () => ({
	dbPool: {
		connect: (...args: unknown[]) => connect(...args),
	},
}));

type SchedulerGlobals = {
	__clipCacheSchedulerStarted?: boolean;
	__clipCacheSchedulerTimer?: ReturnType<typeof setInterval>;
	__clipCacheSchedulerRunning?: boolean;
	__clipCacheSchedulerStats?: unknown;
};

function resetSchedulerGlobals() {
	const globals = globalThis as SchedulerGlobals;
	if (globals.__clipCacheSchedulerTimer) {
		clearInterval(globals.__clipCacheSchedulerTimer);
	}
	delete globals.__clipCacheSchedulerStarted;
	delete globals.__clipCacheSchedulerTimer;
	delete globals.__clipCacheSchedulerRunning;
	delete globals.__clipCacheSchedulerStats;
}

async function loadScheduler() {
	jest.resetModules();
	return import("@/app/lib/clipCacheScheduler");
}

async function flushAsyncWork() {
	await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("lib/clipCacheScheduler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		resetSchedulerGlobals();
	});

	afterEach(() => {
		resetSchedulerGlobals();
	});

	it("does not start in test environment", async () => {
		process.env = { ...process.env, NODE_ENV: "test" };
		delete process.env.NEXT_PHASE;

		const setIntervalSpy = jest.spyOn(global, "setInterval");
		try {
			const { startClipCacheScheduler, getClipCacheSchedulerStats } = await loadScheduler();
			startClipCacheScheduler();

			expect((globalThis as SchedulerGlobals).__clipCacheSchedulerStarted).toBeUndefined();
			expect(getClipCacheSchedulerStats().startedAt).toBeNull();
			expect(setIntervalSpy).not.toHaveBeenCalled();
		} finally {
			setIntervalSpy.mockRestore();
		}
	});

	it("does not start during production build phase", async () => {
		process.env = { ...process.env, NODE_ENV: "production", NEXT_PHASE: "phase-production-build" };
		const setIntervalSpy = jest.spyOn(global, "setInterval");
		try {
			const { startClipCacheScheduler, getClipCacheSchedulerStats } = await loadScheduler();
			startClipCacheScheduler();

			expect((globalThis as SchedulerGlobals).__clipCacheSchedulerStarted).toBeUndefined();
			expect(getClipCacheSchedulerStats().startedAt).toBeNull();
			expect(setIntervalSpy).not.toHaveBeenCalled();
		} finally {
			setIntervalSpy.mockRestore();
		}
	});

	it("runs sync for active owners when lock is acquired", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		const lockClient = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ locked: true }] })
				.mockResolvedValue({ rows: [] }),
			release: jest.fn(),
		};

		connect.mockResolvedValue(lockClient);
		getActiveOverlayOwnerIdsForClipSync.mockResolvedValue(["owner-a", "owner-b"]);

		const { startClipCacheScheduler } = await loadScheduler();
		startClipCacheScheduler();
		await flushAsyncWork();
		await flushAsyncWork();

		expect(getActiveOverlayOwnerIdsForClipSync).toHaveBeenCalledWith(25);
		expect(syncOwnerClipCache).toHaveBeenCalledWith("owner-a");
		expect(syncOwnerClipCache).toHaveBeenCalledWith("owner-b");
		expect(lockClient.release).toHaveBeenCalled();
	});

	it("records failure stats when owner sync throws", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		const lockClient = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ locked: true }] })
				.mockResolvedValue({ rows: [] }),
			release: jest.fn(),
		};
		connect.mockResolvedValue(lockClient);
		getActiveOverlayOwnerIdsForClipSync.mockResolvedValue(["owner-fail"]);
		syncOwnerClipCache.mockRejectedValue(new Error("sync exploded"));

		const { startClipCacheScheduler, getClipCacheSchedulerStats } = await loadScheduler();
		startClipCacheScheduler();
		await flushAsyncWork();
		await flushAsyncWork();

		const stats = getClipCacheSchedulerStats();
		expect(stats.totalRuns).toBe(1);
		expect(stats.totalFailures).toBe(1);
		expect(stats.lastError).toBe("sync exploded");
		expect(lockClient.release).toHaveBeenCalled();
	});

	it("releases lock client even when advisory unlock fails", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		const lockClient = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ locked: true }] })
				.mockRejectedValueOnce(new Error("unlock failed")),
			release: jest.fn(),
		};
		connect.mockResolvedValue(lockClient);
		getActiveOverlayOwnerIdsForClipSync.mockResolvedValue([]);

		const { startClipCacheScheduler, getClipCacheSchedulerStats } = await loadScheduler();
		startClipCacheScheduler();
		await flushAsyncWork();
		await flushAsyncWork();

		expect(lockClient.release).toHaveBeenCalled();
		expect(getClipCacheSchedulerStats().totalRuns).toBe(1);
	});

	it("skips sync run when lock is not acquired", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		const lockClient = {
			query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }),
			release: jest.fn(),
		};
		connect.mockResolvedValue(lockClient);

		const { startClipCacheScheduler } = await loadScheduler();
		startClipCacheScheduler();
		await flushAsyncWork();

		expect(getActiveOverlayOwnerIdsForClipSync).not.toHaveBeenCalled();
		expect(syncOwnerClipCache).not.toHaveBeenCalled();
		expect(lockClient.release).toHaveBeenCalled();
	});

	it("does not start a second scheduler loop once already started", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		const lockClient = {
			query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }),
			release: jest.fn(),
		};
		connect.mockResolvedValue(lockClient);
		const setIntervalSpy = jest.spyOn(global, "setInterval");

		try {
			const { startClipCacheScheduler } = await loadScheduler();
			startClipCacheScheduler();
			startClipCacheScheduler();
			await flushAsyncWork();

			expect(setIntervalSpy).toHaveBeenCalledTimes(1);
			expect(connect).toHaveBeenCalledTimes(1);
		} finally {
			setIntervalSpy.mockRestore();
		}
	});

	it("executes the scheduled interval callback for subsequent runs", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		delete process.env.NEXT_PHASE;

		let intervalCallback: (() => void) | null = null;
		const fakeTimer = { unref: jest.fn() } as unknown as ReturnType<typeof setInterval>;
		const setIntervalSpy = jest.spyOn(global, "setInterval").mockImplementation(((handler: unknown) => {
			intervalCallback = handler as () => void;
			return fakeTimer;
		}) as never);

		const lockClient = {
			query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }),
			release: jest.fn(),
		};
		connect.mockResolvedValue(lockClient);

		try {
			const { startClipCacheScheduler } = await loadScheduler();
			startClipCacheScheduler();
			await flushAsyncWork();
			await flushAsyncWork();

			expect(intervalCallback).toBeTruthy();
			if (intervalCallback) {
				(intervalCallback as () => void)();
			}
			await flushAsyncWork();
			await flushAsyncWork();

			expect(connect).toHaveBeenCalledTimes(2);
			expect(lockClient.release).toHaveBeenCalledTimes(2);
		} finally {
			setIntervalSpy.mockRestore();
		}
	});
});
