import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.ERROR_DSN,
	integrations: [],
	tracesSampleRate: 0,
});
