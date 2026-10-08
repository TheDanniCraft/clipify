import "server-only";
import { isMcpSchemaReady } from "./schema-readiness";
import { pruneMcpOperationalRecords, pruneRevokedMcpCredentials, pruneMcpActivity } from "./cleanup";
import { captureUnexpectedError } from "@lib/sentryServer";

declare global {
	var __mcpCleanupSchedulerStarted: boolean | undefined;
	var __mcpCleanupSchedulerRunning: boolean | undefined;
	var __mcpCleanupSchedulerTimer: ReturnType<typeof setInterval> | undefined;
}

export function startMcpCleanupScheduler() {
	if (process.env.DISABLE_BACKGROUND_JOBS === "true" || process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build" || globalThis.__mcpCleanupSchedulerStarted) return;
	const run = async () => {
		if (globalThis.__mcpCleanupSchedulerRunning) return;
		globalThis.__mcpCleanupSchedulerRunning = true;
		try {
			if (!(await isMcpSchemaReady())) return;
			for (const [prune, action] of [
				[pruneMcpOperationalRecords, "prune-operational-records"],
				[pruneRevokedMcpCredentials, "prune-revoked-credentials"],
				[pruneMcpActivity, "prune-activity"],
			] as const) {
				try {
					await prune({ batchSize: 500 });
				} catch (error) {
					captureUnexpectedError(error, "mcp-cleanup-scheduler", action);
				}
			}
		} finally {
			globalThis.__mcpCleanupSchedulerRunning = false;
		}
	};
	globalThis.__mcpCleanupSchedulerStarted = true;
	void run();
	globalThis.__mcpCleanupSchedulerTimer = setInterval(() => void run(), 30000);
	globalThis.__mcpCleanupSchedulerTimer.unref?.();
}
