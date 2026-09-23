/* istanbul ignore file */
import * as Sentry from "@sentry/nextjs";
import { captureUnexpectedError } from "@lib/sentryServer";

const CLIP_CACHE_SYNC_INTERVAL_MS = 60_000;
const CLIP_CACHE_SYNC_BATCH_SIZE = 25;
const CLIP_CACHE_SYNC_LOCK_KEY = "clip_cache_scheduler";
const CLIP_CACHE_MONITOR_CONFIG = {
	schedule: { type: "interval" as const, value: 1, unit: "minute" as const },
	checkinMargin: 2,
	maxRuntime: 10,
	failureIssueThreshold: 1,
	recoveryThreshold: 1,
	isolateTrace: true,
};

declare global {
	var __clipCacheSchedulerStarted: boolean | undefined;

	var __clipCacheSchedulerTimer: ReturnType<typeof setInterval> | undefined;

	var __clipCacheSchedulerRunning: boolean | undefined;

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
	// Avoid DB activity during `next build` where runtime resources may be unavailable.
	if (process.env.NEXT_PHASE === "phase-production-build") return false;
	return process.env.NODE_ENV !== "test";
}

export function startClipCacheScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis.__clipCacheSchedulerStarted) return;

	const batchSize = CLIP_CACHE_SYNC_BATCH_SIZE;
	const scheduledIntervalMs = CLIP_CACHE_SYNC_INTERVAL_MS;
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
		let lockAcquired = false;
		let runFailed = false;
		let ownerCount = 0;
		const checkInId = Sentry.captureCheckIn({ monitorSlug: "clip-cache-scheduler", status: "in_progress" }, CLIP_CACHE_MONITOR_CONFIG);
		Sentry.metrics.count("clip_cache.scheduler.runs", 1, { attributes: { status: "attempted" } });
		let lockClient: { query: (text: string, values?: unknown[]) => Promise<unknown>; release: () => void } | null = null;
		try {
			const [{ getActiveOverlayOwnerIdsForClipSync }, { syncOwnerClipCache }, { dbPool }] = await Promise.all([import("@actions/database"), import("@actions/twitch"), import("@/db/client")]);
			lockClient = await dbPool.connect();
			const lockResult = (await lockClient.query("select pg_try_advisory_lock(hashtext($1)) as locked", [CLIP_CACHE_SYNC_LOCK_KEY])) as { rows?: Array<{ locked?: boolean }> };
			lockAcquired = Boolean(lockResult.rows?.[0]?.locked);
			if (!lockAcquired) return;
			const ownerIds = await getActiveOverlayOwnerIdsForClipSync(batchSize);
			ownerCount = ownerIds.length;
			for (const ownerId of ownerIds) {
				await Sentry.startSpan({ name: "Sync owner clip cache", op: "task" }, () => syncOwnerClipCache(ownerId));
			}
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.lastRunOwnerCount = ownerIds.length;
				globalThis.__clipCacheSchedulerStats.lastError = null;
			}
		} catch (error) {
			runFailed = true;
			captureUnexpectedError(error, "clip-cache-scheduler", "run");
			Sentry.logger.error("Clip cache scheduler failed", { component: "clip-cache-scheduler" });
			Sentry.metrics.count("clip_cache.scheduler.runs", 1, { attributes: { status: "failed" } });
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.totalFailures += 1;
				globalThis.__clipCacheSchedulerStats.lastError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			if (lockClient && lockAcquired) {
				try {
					await lockClient.query("select pg_advisory_unlock(hashtext($1))", [CLIP_CACHE_SYNC_LOCK_KEY]);
				} catch {
					// Best-effort unlock.
				}
			}
			lockClient?.release();
			globalThis.__clipCacheSchedulerRunning = false;
			const durationMs = Date.now() - started;
			if (!runFailed) {
				Sentry.metrics.count("clip_cache.scheduler.runs", 1, { attributes: { status: "succeeded" } });
				Sentry.logger.info("Clip cache scheduler completed", { component: "clip-cache-scheduler", owner_count: ownerCount, duration_ms: durationMs });
			}
			Sentry.metrics.distribution("clip_cache.scheduler.duration", durationMs, { unit: "millisecond" });
			Sentry.metrics.gauge("clip_cache.scheduler.owner_count", ownerCount);
			Sentry.captureCheckIn({ monitorSlug: "clip-cache-scheduler", status: runFailed ? "error" : "ok", checkInId, duration: durationMs / 1000 });
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.totalRuns += 1;
				globalThis.__clipCacheSchedulerStats.lastRunAt = new Date().toISOString();
				globalThis.__clipCacheSchedulerStats.lastRunDurationMs = durationMs;
			}
		}
	};

	globalThis.__clipCacheSchedulerStarted = true;
	void run();
	globalThis.__clipCacheSchedulerTimer = setInterval(() => {
		void run();
	}, scheduledIntervalMs);
	globalThis.__clipCacheSchedulerTimer.unref?.();
	Sentry.logger.info("Clip cache scheduler started", {
		interval_ms: scheduledIntervalMs,
		batch_size: batchSize,
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
