import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { runOverlayRewardEffects, subscribeOverlayReward } from "./overlay-effects";
import { captureUnexpectedError } from "@lib/sentryServer";

declare global {
	var __overlayEffectSchedulerStarted: boolean | undefined;
	var __overlayEffectSchedulerRunning: boolean | undefined;
	var __overlayEffectSchedulerTimer: ReturnType<typeof setInterval> | undefined;
}

/** Private resource effects continue even when public MCP is disabled. */
export function startOverlayEffectScheduler() {
	if (process.env.DISABLE_BACKGROUND_JOBS === "true" || process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build" || globalThis.__overlayEffectSchedulerStarted) return;
	const run = async () => {
		if (globalThis.__overlayEffectSchedulerRunning) return;
		globalThis.__overlayEffectSchedulerRunning = true;
		try {
			const schema = await db.execute<{ present: boolean }>(sql`SELECT to_regclass('public.overlay_effect_jobs') IS NOT NULL AS present`);
			if (!schema.rows[0]?.present) return;
			await runOverlayRewardEffects({ batchSize: 20, sendReward: subscribeOverlayReward });
		} catch (error) {
			captureUnexpectedError(error, "overlay-effect-scheduler", "deliver-reward-subscriptions");
		} finally {
			globalThis.__overlayEffectSchedulerRunning = false;
		}
	};
	globalThis.__overlayEffectSchedulerStarted = true;
	void run();
	globalThis.__overlayEffectSchedulerTimer = setInterval(() => void run(), 30000);
	globalThis.__overlayEffectSchedulerTimer.unref?.();
}
