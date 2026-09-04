import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	tracesSampleRate: sentryTraceSampleRate,
});
