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
	if (!enabled) return process.env.NODE_ENV !== "test";
	return ["1", "true", "yes", "on"].includes(enabled.toLowerCase());
}

export function startEntitlementsScheduler() {
	if (!shouldRunScheduler()) return;
	if (globalThis[STARTED_KEY]) return;

	const intervalMs = Number(process.env.ENTITLEMENTS_RECONCILE_INTERVAL_MS ?? 5 * 60 * 1000);
	const batchSize = Number(process.env.ENTITLEMENTS_RECONCILE_BATCH_SIZE ?? 100);
	const cooldownHours = Number(process.env.ENTITLEMENTS_RECONCILE_COOLDOWN_HOURS ?? 6);

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
	}, Math.max(30_000, intervalMs));
	console.info("[entitlements] scheduler_started", {
		intervalMs: Math.max(30_000, intervalMs),
		batchSize,
		cooldownHours,
	});
}

