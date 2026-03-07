declare global {
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerStarted: boolean | undefined;
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerRunning: boolean | undefined;
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerStats:
		| {
				startedAt: string;
				intervalMs: number;
				batchSize: number;
				lastRunAt: string | null;
				lastRunDurationMs: number | null;
				lastRunOwnerCount: number;
				totalRuns: number;
				totalFailures: number;
				lastError: string | null;
		  }
		| undefined;
}

function shouldRunScheduler() {
	const enabled = process.env.CLIP_CACHE_SYNC_ENABLED;
	if (enabled == null) return true;
	return ["1", "true", "yes", "on"].includes(enabled.toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

export function startClipCacheScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis.__clipCacheSchedulerStarted) return;

	const intervalMs = parsePositiveInt(process.env.CLIP_CACHE_SYNC_INTERVAL_MS, 60_000);
	const batchSize = parsePositiveInt(process.env.CLIP_CACHE_SYNC_BATCH_SIZE, 25);
	const scheduledIntervalMs = Math.max(30_000, intervalMs);
	globalThis.__clipCacheSchedulerStats = {
		startedAt: new Date().toISOString(),
		intervalMs: scheduledIntervalMs,
		batchSize,
		lastRunAt: null,
		lastRunDurationMs: null,
		lastRunOwnerCount: 0,
		totalRuns: 0,
		totalFailures: 0,
		lastError: null,
	};

	const run = async () => {
		if (globalThis.__clipCacheSchedulerRunning) return;
		const started = Date.now();
		globalThis.__clipCacheSchedulerRunning = true;
		try {
			const [{ getActiveOverlayOwnerIdsForClipSync }, { syncOwnerClipCache }] = await Promise.all([import("@actions/database"), import("@actions/twitch")]);
			const ownerIds = await getActiveOverlayOwnerIdsForClipSync(batchSize);
			for (const ownerId of ownerIds) {
				await syncOwnerClipCache(ownerId);
			}
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.lastRunOwnerCount = ownerIds.length;
				globalThis.__clipCacheSchedulerStats.lastError = null;
			}
		} catch (error) {
			console.error("[clip-cache] scheduler_run_failed", error);
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.totalFailures += 1;
				globalThis.__clipCacheSchedulerStats.lastError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			globalThis.__clipCacheSchedulerRunning = false;
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.totalRuns += 1;
				globalThis.__clipCacheSchedulerStats.lastRunAt = new Date().toISOString();
				globalThis.__clipCacheSchedulerStats.lastRunDurationMs = Date.now() - started;
			}
		}
	};

	globalThis.__clipCacheSchedulerStarted = true;
	void run();
	globalThis.__clipCacheSchedulerTimer = setInterval(() => {
		void run();
	}, scheduledIntervalMs);
	globalThis.__clipCacheSchedulerTimer.unref?.();
	console.info("[clip-cache] scheduler_started", {
		intervalMs: scheduledIntervalMs,
		batchSize,
	});
}

export function getClipCacheSchedulerStats() {
	return (
		globalThis.__clipCacheSchedulerStats ?? {
			startedAt: null,
			intervalMs: null,
			batchSize: null,
			lastRunAt: null,
			lastRunDurationMs: null,
			lastRunOwnerCount: 0,
			totalRuns: 0,
			totalFailures: 0,
			lastError: null,
		}
	);
}
