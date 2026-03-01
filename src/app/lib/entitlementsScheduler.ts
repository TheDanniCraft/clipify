import { reconcileRevokedUsersBatch } from "@lib/entitlements";

declare global {
	// eslint-disable-next-line no-var
	var __entitlementsSchedulerStarted: boolean | undefined;
	// eslint-disable-next-line no-var
	var __entitlementsSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	// eslint-disable-next-line no-var
	var __entitlementsSchedulerRunning: boolean | undefined;
}

function shouldRunScheduler() {
	const enabled = process.env.ENTITLEMENTS_RECONCILE_ENABLED;
	if (enabled == null) return process.env.NODE_ENV === "development";
	return ["1", "true", "yes", "on"].includes(enabled.toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

export function startEntitlementsScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis.__entitlementsSchedulerStarted) return;

	const intervalMs = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_INTERVAL_MS, 5 * 60 * 1000);
	const batchSize = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_BATCH_SIZE, 100);
	const cooldownHours = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_COOLDOWN_HOURS, 6);
	const scheduledIntervalMs = Math.max(30_000, intervalMs);

	const run = async () => {
		if (globalThis.__entitlementsSchedulerRunning) return;
		globalThis.__entitlementsSchedulerRunning = true;
		try {
			await reconcileRevokedUsersBatch(batchSize, cooldownHours);
		} catch (error) {
			console.error("[entitlements] scheduler_run_failed", error);
		} finally {
			globalThis.__entitlementsSchedulerRunning = false;
		}
	};

	globalThis.__entitlementsSchedulerStarted = true;
	void run();
	globalThis.__entitlementsSchedulerTimer = setInterval(() => {
		void run();
	}, scheduledIntervalMs);
	globalThis.__entitlementsSchedulerTimer.unref?.();
	console.info("[entitlements] scheduler_started", {
		intervalMs: scheduledIntervalMs,
		batchSize,
		cooldownHours,
	});
}

