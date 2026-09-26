import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection, sentryEnabled, sentryEnvironment, sentryRelease, sentryTraceSampleRate } from "./sentry.shared.config";
import { browserMeasurementAllowed } from "./src/app/lib/consent/browserMeasurement";
import { beforeSendError, beforeSendLog, beforeSendMetric, beforeSendSpan, beforeSendTransaction } from "./sentry.privacy";

const isE2ETest = process.env.E2E_TEST_MODE === "true";

Sentry.init({
	dsn: isE2ETest ? "https://public@o0.ingest.de.sentry.io/0" : process.env.SENTRY_DSN,
	enabled: isE2ETest || sentryEnabled,
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
	// Browser compliance tests exercise the real SDK lifecycle without sending
	// synthetic events to Sentry or depending on external network access.
	transport: isE2ETest
		? () => ({
				send: async () => ({ statusCode: 200 }),
				flush: async () => true,
			})
		: undefined,
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
