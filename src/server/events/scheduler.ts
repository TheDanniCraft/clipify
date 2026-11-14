import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { refreshAwardDataResults } from "./freeze";
import { cleanupAwardUploads } from "./uploads";
import { captureUnexpectedError } from "@lib/sentryServer";
declare global {
	var __awardSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	var __awardSchedulerRunning: boolean | undefined;
}
export function startAwardScheduler() {
	if (process.env.DISABLE_BACKGROUND_JOBS === "true" || process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build" || globalThis.__awardSchedulerTimer) return;
	const run = async () => {
		if (globalThis.__awardSchedulerRunning) return;
		globalThis.__awardSchedulerRunning = true;
		try {
			const schema = await db.execute<{ present: boolean }>(sql`SELECT to_regclass('public.award_assets') IS NOT NULL AS present`);
			if (schema.rows[0]?.present) {
				await refreshAwardDataResults();
				await cleanupAwardUploads();
			}
		} catch (error) {
			captureUnexpectedError(error, "award-scheduler", "cleanup-uploads");
		} finally {
			globalThis.__awardSchedulerRunning = false;
		}
	};
	globalThis.__awardSchedulerTimer = setInterval(() => void run(), 60000);
	globalThis.__awardSchedulerTimer.unref?.();
	void run();
}
