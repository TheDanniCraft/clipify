/* istanbul ignore file */

import { refreshCommunitySnapshot } from "@lib/community";

declare global {
	var __communitySnapshotSchedulerStarted: boolean | undefined;
	var __communitySnapshotSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	var __communitySnapshotSchedulerRunning: boolean | undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

function shouldRunScheduler() {
	if (process.env.NEXT_PHASE === "phase-production-build") return false;
	return process.env.NODE_ENV !== "test";
}

export function startCommunitySnapshotScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis.__communitySnapshotSchedulerStarted) return;

	const intervalMs = parsePositiveInt(process.env.COMMUNITY_SNAPSHOT_REFRESH_INTERVAL_MS, 60_000);
	const scheduledIntervalMs = Math.max(30_000, intervalMs);

	const run = async () => {
		if (globalThis.__communitySnapshotSchedulerRunning) return;
		globalThis.__communitySnapshotSchedulerRunning = true;
		try {
			await refreshCommunitySnapshot();
		} catch (error) {
			console.error("[community] scheduler_run_failed", error);
		} finally {
			globalThis.__communitySnapshotSchedulerRunning = false;
		}
	};

	globalThis.__communitySnapshotSchedulerStarted = true;
	void run();
	globalThis.__communitySnapshotSchedulerTimer = setInterval(() => {
		void run();
	}, scheduledIntervalMs);
	globalThis.__communitySnapshotSchedulerTimer.unref?.();
	console.info("[community] scheduler_started", {
		intervalMs: scheduledIntervalMs,
	});
}
