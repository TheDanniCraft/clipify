import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.ERROR_DSN,
	enabled: process.env.NODE_ENV === "production",
	integrations: [],
	tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
