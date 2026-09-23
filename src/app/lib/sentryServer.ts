import * as Sentry from "@sentry/nextjs";

export function captureUnexpectedError(error: unknown, component: string, operation: string) {
	return Sentry.withScope((scope) => {
		scope.setTag("component", component);
		scope.setTag("operation", operation);
		return Sentry.captureException(error);
	});
}
