/* istanbul ignore file */
import * as Sentry from "@sentry/nextjs";
import { captureUnexpectedError } from "@lib/sentryServer";
import { getOperationalEnvironment, operationalCount, operationalDuration, operationalGauge } from "@lib/operationalHealth";

import { clipCrawlBatchSize, runClipCrawlerBatch } from "@/server/clip-crawler/worker";
import { seedClipCrawlJobs } from "@/server/clip-crawler/queue";

const CLIP_CACHE_SYNC_INTERVAL_MS = 60_000;
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

function shouldReportMonitorCheckIns() {
	return getOperationalEnvironment() === "production";
}

export function startClipCacheScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis.__clipCacheSchedulerStarted) return;

	const batchSize = clipCrawlBatchSize;
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
		let outcome: "pending" | "succeeded" | "failed" = "pending";
		let ownerCount = 0;
		let checkInId: string | undefined;
		try {
			if (shouldReportMonitorCheckIns()) {
				checkInId = Sentry.captureCheckIn({ monitorSlug: "clip-cache-scheduler", status: "in_progress" }, CLIP_CACHE_MONITOR_CONFIG);
			}
			operationalCount("clipify.clip_cache.scheduler.runs", 1, { status: "attempted" });
			await seedClipCrawlJobs();
			ownerCount = await runClipCrawlerBatch();
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.lastRunOwnerCount = ownerCount;
				globalThis.__clipCacheSchedulerStats.lastError = null;
			}
			outcome = "succeeded";
		} catch (error) {
			outcome = "failed";
			captureUnexpectedError(error, "clip-cache-scheduler", "run");
			Sentry.logger.error("Clip cache scheduler failed", { component: "clip-cache-scheduler" });
			operationalCount("clipify.clip_cache.scheduler.runs", 1, { status: "failed" });
			if (globalThis.__clipCacheSchedulerStats) {
				globalThis.__clipCacheSchedulerStats.totalFailures += 1;
				globalThis.__clipCacheSchedulerStats.lastError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			globalThis.__clipCacheSchedulerRunning = false;
			const durationMs = Date.now() - started;
			if (outcome === "succeeded") {
				operationalCount("clipify.clip_cache.scheduler.runs", 1, { status: "succeeded" });
				Sentry.logger.info("Clip cache scheduler completed", { component: "clip-cache-scheduler", owner_count: ownerCount, duration_ms: durationMs });
			}
			{
				operationalDuration("clipify.clip_cache.scheduler.duration", durationMs);
				operationalGauge("clipify.clip_cache.scheduler.owner_count", ownerCount);
				if (checkInId) Sentry.captureCheckIn({ monitorSlug: "clip-cache-scheduler", status: outcome === "failed" ? "error" : "ok", checkInId, duration: durationMs / 1000 });
			}
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
