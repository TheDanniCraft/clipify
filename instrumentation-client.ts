import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
import { browserMeasurementAllowed } from "./src/app/lib/consent/browserMeasurement";
import { beforeSendError, beforeSendSpan, beforeSendTransaction } from "./sentry.privacy";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	tracesSampler: () => (browserMeasurementAllowed() ? sentryTraceSampleRate : 0),
	sendDefaultPii: false,
	beforeSend: beforeSendError,
	beforeSendTransaction,
	beforeSendSpan,
	beforeBreadcrumb: (breadcrumb) => ({ timestamp: breadcrumb.timestamp, category: breadcrumb.category, type: breadcrumb.type, level: breadcrumb.level }),
	// Replay is added dynamically only after c15t grants measurement consent.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,
	integrations: (defaults) => [...defaults.filter((integration) => integration.name !== "BrowserSession" && integration.name !== "BrowserTracing"), Sentry.browserTracingIntegration({ linkPreviousTrace: "off" })],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
