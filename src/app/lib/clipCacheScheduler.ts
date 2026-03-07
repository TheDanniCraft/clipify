import { getActiveOverlayOwnerIdsForClipSync } from "@actions/database";
import { syncOwnerClipCache } from "@actions/twitch";

declare global {
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerStarted: boolean | undefined;
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	// eslint-disable-next-line no-var
	var __clipCacheSchedulerRunning: boolean | undefined;
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

	const run = async () => {
		if (globalThis.__clipCacheSchedulerRunning) return;
		globalThis.__clipCacheSchedulerRunning = true;
		try {
			const ownerIds = await getActiveOverlayOwnerIdsForClipSync(batchSize);
			for (const ownerId of ownerIds) {
				await syncOwnerClipCache(ownerId);
			}
		} catch (error) {
			console.error("[clip-cache] scheduler_run_failed", error);
		} finally {
			globalThis.__clipCacheSchedulerRunning = false;
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

