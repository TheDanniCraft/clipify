import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryProfileSampleRate, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
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
	beforeBreadcrumb: (breadcrumb) => ({ timestamp: breadcrumb.timestamp, category: breadcrumb.category, type: breadcrumb.type, level: breadcrumb.level }),
	tracesSampleRate: sentryTraceSampleRate,
	profilesSampleRate: sentryProfileSampleRate,
	integrations: (defaults) => [...defaults, Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }), nodeProfilingIntegration()],
});
