import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	tracesSampleRate: sentryTraceSampleRate,
	// Replay starts only after AdOpt reports explicit consent.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,
	integrations: [
		Sentry.replayIntegration({
			maskAllText: true,
			maskAllInputs: true,
			blockAllMedia: true,
			block: ["iframe", ".sentry-block", "[data-sentry-block]"],
		}),
	],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
