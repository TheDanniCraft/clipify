import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
import { browserMeasurementAllowed } from "./src/app/lib/consent/browserMeasurement";
import { beforeSendError, beforeSendLog, beforeSendMetric, beforeSendSpan, beforeSendTransaction } from "./sentry.privacy";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	enabled: sentryEnabled,
	environment: sentryEnvironment,
	release: sentryRelease,
	dataCollection: sentryDataCollection,
	enableLogs: true,
	enableMetrics: true,
	tracesSampler: () => (browserMeasurementAllowed() ? sentryTraceSampleRate : 0),
	sendDefaultPii: false,
	beforeSend: beforeSendError,
	beforeSendTransaction,
	beforeSendSpan,
	beforeSendLog,
	beforeSendMetric,
	beforeBreadcrumb: (breadcrumb) => ({ timestamp: breadcrumb.timestamp, category: breadcrumb.category, type: breadcrumb.type, level: breadcrumb.level }),
	// Replay is added dynamically only after c15t grants measurement consent.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,
	integrations: (defaults) => [
		...defaults.filter((integration) => integration.name !== "BrowserSession" && integration.name !== "BrowserTracing"),
		Sentry.browserTracingIntegration({ linkPreviousTrace: "off" }),
		Sentry.feedbackIntegration({
			autoInject: false,
			colorScheme: "system",
			enableScreenshot: true,
			showName: true,
			showEmail: true,
			isNameRequired: false,
			isEmailRequired: false,
			triggerLabel: "Report a problem",
			formTitle: "Report a problem",
			submitButtonLabel: "Send report",
			messagePlaceholder: "What happened, and what did you expect?",
			successMessageText: "Thanks — your report has been sent.",
			themeLight: { submitBackground: "#7c3aed", submitBackgroundHover: "#6d28d9", submitBorder: "#7c3aed" },
			themeDark: { submitBackground: "#8b5cf6", submitBackgroundHover: "#7c3aed", submitBorder: "#8b5cf6" },
		}),
	],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
