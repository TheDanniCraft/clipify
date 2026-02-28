import { reconcileRevokedUsersBatch } from "@lib/entitlements";

const STARTED_KEY = "__entitlementsSchedulerStarted";
const TIMER_KEY = "__entitlementsSchedulerTimer";

declare global {
	// eslint-disable-next-line no-var
	var __entitlementsSchedulerStarted: boolean | undefined;
	// eslint-disable-next-line no-var
	var __entitlementsSchedulerTimer: ReturnType<typeof setInterval> | undefined;
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
	if (globalThis[STARTED_KEY]) return;

	const intervalMs = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_INTERVAL_MS, 5 * 60 * 1000);
	const batchSize = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_BATCH_SIZE, 100);
	const cooldownHours = parsePositiveInt(process.env.ENTITLEMENTS_RECONCILE_COOLDOWN_HOURS, 6);
	const scheduledIntervalMs = Math.max(30_000, intervalMs);

	const run = async () => {
		try {
			await reconcileRevokedUsersBatch(batchSize, cooldownHours);
		} catch (error) {
			console.error("[entitlements] scheduler_run_failed", error);
		}
	};

	globalThis[STARTED_KEY] = true;
	void run();
	globalThis[TIMER_KEY] = setInterval(() => {
		void run();
	}, scheduledIntervalMs);
	console.info("[entitlements] scheduler_started", {
		intervalMs: scheduledIntervalMs,
		batchSize,
		cooldownHours,
	});
}

