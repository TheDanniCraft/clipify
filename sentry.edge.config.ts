import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
import { beforeSendError, beforeSendLog, beforeSendMetric, beforeSendSpan, beforeSendTransaction } from "./sentry.privacy";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	enableLogs: true,
	enableMetrics: true,
	sendDefaultPii: false,
	beforeSend: beforeSendError,
	beforeSendTransaction,
	beforeSendSpan,
	beforeSendLog,
	beforeSendMetric,
	integrations: (defaults) => [...defaults, Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
	beforeBreadcrumb: (breadcrumb) => ({ timestamp: breadcrumb.timestamp, category: breadcrumb.category, type: breadcrumb.type, level: breadcrumb.level }),
	tracesSampleRate: sentryTraceSampleRate,
});
