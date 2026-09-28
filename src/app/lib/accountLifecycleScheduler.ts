import { suspendDueDatabaseAccountDeletions } from "@/server/account-lifecycle/database";
import { endDueDatabaseAgencyAllocations } from "@/server/agencies/database";
import { captureUnexpectedError } from "@lib/sentryServer";

declare global {
	var __accountLifecycleSchedulerStarted: boolean | undefined;
	var __accountLifecycleSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	var __accountLifecycleSchedulerRunning: boolean | undefined;
}

export function startAccountLifecycleScheduler() {
	if (globalThis.__accountLifecycleSchedulerStarted) return;
	if (process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build") return;
	const configured = Number(process.env.ACCOUNT_LIFECYCLE_INTERVAL_MS);
	const intervalMs = Math.max(30_000, Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 60_000);
	const run = async () => {
		if (globalThis.__accountLifecycleSchedulerRunning) return;
		globalThis.__accountLifecycleSchedulerRunning = true;
		try {
			await Promise.all([suspendDueDatabaseAccountDeletions(), endDueDatabaseAgencyAllocations()]);
		} catch (error) {
			captureUnexpectedError(error, "account-lifecycle-scheduler", "suspend-due-deletions");
			console.error("[account-lifecycle] scheduler_run_failed", error);
		} finally {
			globalThis.__accountLifecycleSchedulerRunning = false;
		}
	};
	globalThis.__accountLifecycleSchedulerStarted = true;
	void run();
	globalThis.__accountLifecycleSchedulerTimer = setInterval(() => void run(), intervalMs);
	globalThis.__accountLifecycleSchedulerTimer.unref?.();
	console.info("[account-lifecycle] scheduler_started", { intervalMs });
}
