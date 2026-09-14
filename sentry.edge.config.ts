import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
import { beforeSendError, beforeSendSpan, beforeSendTransaction } from "./sentry.privacy";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	sendDefaultPii: false,
	beforeSend: beforeSendError,
	beforeSendTransaction,
	beforeSendSpan,
	beforeBreadcrumb: (breadcrumb) => ({ timestamp: breadcrumb.timestamp, category: breadcrumb.category, type: breadcrumb.type, level: breadcrumb.level }),
	tracesSampleRate: sentryTraceSampleRate,
});
