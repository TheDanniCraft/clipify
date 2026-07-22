import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { RunnerStatus } from "@types";

const RUNNER_CHECK_INTERVAL_MS = 15_000;

export function startRunnerScheduler() {
	if (process.env.NEXT_PHASE === "phase-production-build") return;
	if (process.env.NODE_ENV === "test") return;
	if (globalThis.__runnerSchedulerStarted) return;

	const run = async () => {
		try {
			// Find runners that are marked "online" but haven't sent a heartbeat in >30 seconds
			const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

			await db.update(runnersTable)
				.set({ status: RunnerStatus.Offline })
				.where(
					and(
						eq(runnersTable.status, RunnerStatus.Online),
						lt(runnersTable.lastHeartbeatAt, thirtySecondsAgo)
					)
				);
		} catch (error) {
			console.error("[RunnerScheduler] Error marking runners offline:", error);
		}
	};

	globalThis.__runnerSchedulerStarted = true;
	void run();
	const timer = setInterval(() => void run(), RUNNER_CHECK_INTERVAL_MS);
	timer.unref?.();

	console.info("[RunnerScheduler] Started, checking every 15s");
}

declare global {
	var __runnerSchedulerStarted: boolean | undefined;
}
