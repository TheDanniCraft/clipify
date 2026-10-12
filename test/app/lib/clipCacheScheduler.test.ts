/** @jest-environment node */
export {};
const seedClipCrawlJobs = jest.fn();
const runClipCrawlerBatch = jest.fn();
const captureCheckIn = jest.fn((..._args: unknown[]) => "check-in");
const operationalCount = jest.fn();
jest.mock("@/server/clip-crawler/queue", () => ({ seedClipCrawlJobs: (...args: unknown[]) => seedClipCrawlJobs(...args) }));
jest.mock("@/server/clip-crawler/worker", () => ({ clipCrawlBatchSize: 50, runClipCrawlerBatch: (...args: unknown[]) => runClipCrawlerBatch(...args) }));
jest.mock("@sentry/nextjs", () => ({ captureCheckIn: (...args: unknown[]) => captureCheckIn(...args), logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
jest.mock("@lib/operationalHealth", () => ({ getOperationalEnvironment: () => (process.env.IS_PREVIEW === "true" ? "preview" : "production"), operationalCount: (...args: unknown[]) => operationalCount(...args), operationalDuration: jest.fn(), operationalGauge: jest.fn() }));
const environment = process.env;
function reset() {
	if (globalThis.__clipCacheSchedulerTimer) clearInterval(globalThis.__clipCacheSchedulerTimer);
	delete globalThis.__clipCacheSchedulerStarted;
	delete globalThis.__clipCacheSchedulerTimer;
	delete globalThis.__clipCacheSchedulerRunning;
	delete globalThis.__clipCacheSchedulerStats;
}
beforeEach(() => {
	jest.clearAllMocks();
	reset();
	process.env = { ...environment, NODE_ENV: "production" };
	delete process.env.NEXT_PHASE;
	delete process.env.IS_PREVIEW;
	seedClipCrawlJobs.mockResolvedValue(4);
	runClipCrawlerBatch.mockResolvedValue(2);
});
afterEach(() => {
	reset();
	process.env = environment;
});
async function load() {
	jest.resetModules();
	return import("@/app/lib/clipCacheScheduler");
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test.each(["test", "build"])("does not crawl during %s", async (mode) => {
	if (mode === "test") process.env = { ...process.env, NODE_ENV: "test" };
	else process.env.NEXT_PHASE = "phase-production-build";
	const scheduler = await load();
	scheduler.startClipCacheScheduler();
	await flush();
	expect(seedClipCrawlJobs).not.toHaveBeenCalled();
	expect(runClipCrawlerBatch).not.toHaveBeenCalled();
	expect(scheduler.getClipCacheSchedulerStats().startedAt).toBeNull();
});
test("seeds durable jobs and records the number of processed creators", async () => {
	const scheduler = await load();
	scheduler.startClipCacheScheduler();
	await flush();
	expect(seedClipCrawlJobs).toHaveBeenCalledTimes(1);
	expect(runClipCrawlerBatch).toHaveBeenCalledTimes(1);
	expect(scheduler.getClipCacheSchedulerStats()).toMatchObject({ batchSize: 50, totalRuns: 1, lastRunOwnerCount: 2, totalFailures: 0 });
	expect(captureCheckIn).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));
});
test("preview runs do not create production Sentry monitor check-ins", async () => {
	process.env.IS_PREVIEW = "true";
	const scheduler = await load();
	scheduler.startClipCacheScheduler();
	await flush();
	expect(runClipCrawlerBatch).toHaveBeenCalled();
	expect(captureCheckIn).not.toHaveBeenCalled();
});
test("a failed queue run clears the running guard and reports failure", async () => {
	runClipCrawlerBatch.mockRejectedValue(new Error("Database unavailable"));
	const scheduler = await load();
	scheduler.startClipCacheScheduler();
	await flush();
	expect(globalThis.__clipCacheSchedulerRunning).toBe(false);
	expect(scheduler.getClipCacheSchedulerStats()).toMatchObject({ totalFailures: 1, lastError: "Database unavailable" });
	expect(operationalCount).toHaveBeenCalledWith("clipify.clip_cache.scheduler.runs", 1, { status: "failed" });
});
test("starting twice does not create two scheduler loops", async () => {
	const scheduler = await load();
	scheduler.startClipCacheScheduler();
	scheduler.startClipCacheScheduler();
	await flush();
	expect(runClipCrawlerBatch).toHaveBeenCalledTimes(1);
});
test("interval ticks do not overlap a still-running batch", async () => {
	let finish!: (count: number) => void;
	runClipCrawlerBatch.mockImplementation(
		() =>
			new Promise<number>((resolve) => {
				finish = resolve;
			}),
	);
	let tick!: () => void;
	const timer = jest.spyOn(global, "setInterval").mockImplementation((handler: unknown) => {
		tick = handler as () => void;
		return { unref: () => {} } as ReturnType<typeof setInterval>;
	});
	try {
		const scheduler = await load();
		scheduler.startClipCacheScheduler();
		await flush();
		tick();
		await flush();
		expect(runClipCrawlerBatch).toHaveBeenCalledTimes(1);
		finish(1);
		await flush();
		tick();
		await flush();
		expect(runClipCrawlerBatch).toHaveBeenCalledTimes(2);
		finish(1);
		await flush();
	} finally {
		delete globalThis.__clipCacheSchedulerTimer;
		timer.mockRestore();
	}
});
