import * as Sentry from "@sentry/nextjs";
import { toPublicResourceError } from "@/server/resources/errors";

export function captureUnexpectedError(error: unknown, component: string, operation: string) {
	// Runner business denials are already returned to the caller as safe results.
	// Preserve reporting for unclassified infrastructure and programming failures.
	if (component === "runner-actions" && toPublicResourceError(error).code !== "SERVICE_UNAVAILABLE") return;
	return Sentry.withScope((scope) => {
		scope.setTag("component", component);
		scope.setTag("operation", operation);
		return Sentry.captureException(error);
	});
}
