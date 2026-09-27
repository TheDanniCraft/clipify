import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
		if (process.env.DISABLE_BACKGROUND_JOBS !== "true") {
			const [{ startEntitlementsScheduler }, { startClipCacheScheduler }, { startCommunitySnapshotScheduler }, { startRunnerScheduler }, { startConsentRetentionScheduler }, { startOperationalHealthPublisher }] = await Promise.all([import("@lib/entitlementsScheduler"), import("@lib/clipCacheScheduler"), import("@lib/communityScheduler"), import("@lib/runnerScheduler"), import("@lib/consent/retention"), import("@lib/operationalHealth")]);
			startEntitlementsScheduler();
			startClipCacheScheduler();
			startCommunitySnapshotScheduler();
			startRunnerScheduler();
			startConsentRetentionScheduler();
			startOperationalHealthPublisher();
		}
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("../sentry.edge.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
