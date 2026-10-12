/** @jest-environment node */
import type { CrawlJob } from "@/server/clip-crawler/queue";
const syncOwnerClipCache = jest.fn();
const claim = jest.fn(),
	complete = jest.fn(),
	retry = jest.fn(),
	renew = jest.fn();
jest.mock("server-only", () => ({}));
jest.mock("@/app/actions/twitch", () => ({ syncOwnerClipCache: (...args: unknown[]) => syncOwnerClipCache(...args) }));
jest.mock("@/db/client", () => ({ dbPool: { query: async () => ({ rows: [{ active: true }] }) } }));
jest.mock("@/app/lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
jest.mock("@/app/lib/operationalHealth", () => ({ operationalCount: jest.fn(), operationalDuration: jest.fn() }));
jest.mock("@/server/clip-crawler/queue", () => ({ claimClipCrawlJob: (...args: unknown[]) => claim(...args), completeClipCrawlJob: (...args: unknown[]) => complete(...args), retryClipCrawlJob: (...args: unknown[]) => retry(...args), renewClipCrawlLease: (...args: unknown[]) => renew(...args) }));
import { runClipCrawlerBatch } from "@/server/clip-crawler/worker";
const job = (id: string): CrawlJob => ({ creator_id: id, kind: "recent", requested_at: null, request_marker: null, lease_id: "lease", failures: 0 });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeEach(() => {
	jest.clearAllMocks();
	globalThis.__clipCrawlActiveWorkers = 0;
	globalThis.__clipCrawlClaimCounter = 0;
	claim.mockResolvedValue(null);
	complete.mockResolvedValue(true);
	retry.mockResolvedValue(true);
	renew.mockResolvedValue(true);
	syncOwnerClipCache.mockResolvedValue({ status: "completed" });
});
test("a batch claims at most 50 jobs and runs at most four provider jobs concurrently", async () => {
	let count = 0,
		active = 0,
		maximum = 0;
	claim.mockImplementation(async () => job(String(count++)));
	syncOwnerClipCache.mockImplementation(async () => {
		active++;
		maximum = Math.max(maximum, active);
		await flush();
		active--;
		return { status: "completed" };
	});
	expect(await runClipCrawlerBatch()).toBe(50);
	expect(claim).toHaveBeenCalledTimes(50);
	expect(maximum).toBe(4);
	expect(complete).toHaveBeenCalledTimes(50);
	expect(globalThis.__clipCrawlActiveWorkers).toBe(0);
	expect(claim.mock.calls.slice(0, 4).map(([options]) => options.preferManual)).toEqual([true, false, true, false]);
});
test("manual wakeups share capacity with an existing batch", async () => {
	let finish!: () => void;
	const waiting = new Promise<void>((resolve) => {
		finish = resolve;
	});
	claim.mockImplementation(async () => job("creator"));
	syncOwnerClipCache.mockImplementation(async () => {
		await waiting;
		return { status: "completed" };
	});
	const running = runClipCrawlerBatch({ maxJobs: 4 });
	await flush();
	expect(await runClipCrawlerBatch({ creatorId: "manual", maxJobs: 1 })).toBe(0);
	expect(syncOwnerClipCache).toHaveBeenCalledTimes(4);
	finish();
	await running;
	expect(globalThis.__clipCrawlActiveWorkers).toBe(0);
});
test("Twitch rate-limit deadlines delay retry rather than completing a job", async () => {
	claim.mockResolvedValueOnce(job("rate-limited"));
	const deadline = new Date(Date.now() + 120000).toISOString();
	syncOwnerClipCache.mockResolvedValue({ status: "retry", retryAt: deadline });
	await runClipCrawlerBatch({ maxJobs: 1 });
	expect(complete).not.toHaveBeenCalled();
	expect(retry.mock.calls[0][2].toISOString()).toBe(deadline);
});
test("completed history stops rescheduling while recent scans remain enabled", async () => {
	const history = { ...job("creator"), kind: "backfill" };
	claim.mockResolvedValueOnce(history);
	syncOwnerClipCache.mockResolvedValue({ status: "completed", backfillComplete: true });
	await runClipCrawlerBatch({ maxJobs: 1 });
	expect(complete).toHaveBeenCalledWith(history, null);
});
test("worker failure leaves a retry and releases process capacity", async () => {
	claim.mockResolvedValueOnce(job("failure"));
	syncOwnerClipCache.mockRejectedValue(new Error("Provider failed"));
	await runClipCrawlerBatch({ maxJobs: 1 });
	expect(retry).toHaveBeenCalledWith(expect.anything(), "Crawl failed", expect.any(Date));
	expect(globalThis.__clipCrawlActiveWorkers).toBe(0);
});
test("a lost heartbeat prevents the old worker from completing or retrying the lease", async () => {
	jest.useFakeTimers();
	try {
		let finish!: () => void;
		const waiting = new Promise<void>((resolve) => {
			finish = resolve;
		});
		claim.mockResolvedValueOnce(job("lost-lease"));
		renew.mockResolvedValue(false);
		syncOwnerClipCache.mockImplementation(async () => {
			await waiting;
			return { status: "completed" };
		});
		const running = runClipCrawlerBatch({ maxJobs: 1 });
		await jest.advanceTimersByTimeAsync(30000);
		finish();
		await running;
		expect(renew).toHaveBeenCalledTimes(1);
		expect(complete).not.toHaveBeenCalled();
		expect(retry).not.toHaveBeenCalled();
	} finally {
		jest.useRealTimers();
	}
});

test("claim failure drains already-running work before the batch rejects", async () => {
	let finish!: () => void;
	const waiting = new Promise<void>((resolve) => {
		finish = resolve;
	});
	claim.mockResolvedValueOnce(job("running")).mockRejectedValueOnce(new Error("Claim failed"));
	syncOwnerClipCache.mockImplementation(async () => {
		await waiting;
		return { status: "completed" };
	});
	let ended = false;
	const running = runClipCrawlerBatch({ maxJobs: 4 }).catch((error) => {
		ended = true;
		throw error;
	});
	const rejected = expect(running).rejects.toThrow("Claim failed");
	await flush();
	expect(ended).toBe(false);
	finish();
	await rejected;
	expect(globalThis.__clipCrawlActiveWorkers).toBe(0);
});

test("a slow batch stops claiming after one minute and drains its current jobs", async () => {
	let clock = Date.now();
	const time = jest.spyOn(Date, "now").mockImplementation(() => clock);
	try {
		let count = 0;
		claim.mockImplementation(async () => job(String(count++)));
		syncOwnerClipCache.mockImplementation(async () => {
			clock += 61000;
			return { status: "completed" };
		});
		expect(await runClipCrawlerBatch()).toBe(4);
		expect(claim).toHaveBeenCalledTimes(4);
		expect(complete).toHaveBeenCalledTimes(4);
		expect(globalThis.__clipCrawlActiveWorkers).toBe(0);
	} finally {
		time.mockRestore();
	}
});
