import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
		const [{ startEntitlementsScheduler }, { startClipCacheScheduler }, { startCommunitySnapshotScheduler }, { startRunnerScheduler }] = await Promise.all([import("@lib/entitlementsScheduler"), import("@lib/clipCacheScheduler"), import("@lib/communityScheduler"), import("@lib/runnerScheduler")]);
		startEntitlementsScheduler();
		startClipCacheScheduler();
		startCommunitySnapshotScheduler();
		startRunnerScheduler();
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("../sentry.edge.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
