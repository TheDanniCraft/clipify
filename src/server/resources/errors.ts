import { randomUUID } from "node:crypto";

/** Internal reconciliation signal, converted to a normal failure by the workflow boundary.
 * Keep this type independent of Runner services and their encryption configuration.
 */
export class LegacyBroadcastRecoveryRequired extends Error {
	constructor() {
		super("RUNNER_RECOVERY_REQUIRED");
	}
}

const messages = {
	SCHEDULE_WINDOW_ENDED: "This scheduled window is not active. Use Manual control or plan another event.",
	ACTIVE_OCCURRENCE_LOCKED: "This occurrence is active. Its schedule stays locked until the window ends.",
	RUNNER_TARGET_LIMIT: "Free allows one destination per broadcast. Choose one destination or use Pro for multistreaming.",
	RUNNER_INGEST_IN_USE: "This Runner already has a live fallback broadcast. Stop it and wait for its outputs to close before starting another, or use a different Runner device.",
	RUNNER_RECOVERY_REQUIRED: "Your previous Runner has not confirmed that its outputs closed. Reconnect that device and stop the existing broadcast before starting another.",
	RUNNER_CONCURRENCY_LIMIT: "Free allows one active broadcast across your Runner devices. Stop the existing broadcast before starting another, or use Pro.",
	INVALID_INPUT: "Check your input and fetch the current page again.",
	ACCESS_DENIED: "Your current permissions do not allow this operation.",
	RESOURCE_UNAVAILABLE: "This resource is unavailable.",
	RESOURCE_IN_USE: "Remove this destination from its saved broadcasts and schedules before deleting it.",
	FEATURE_RESTRICTED: "Your creator’s current plan does not include this capability.",
	PLAN_LIMIT_REACHED: "Your creator has reached the current plan limit.",
	CONFLICT: "This resource changed. Read its current configuration before editing again.",
	RETRY_CONFLICT: "This retry key was already used for a different request.",
	RATE_LIMITED: "Too many requests. Try again later.",
	SERVICE_UNAVAILABLE: "Clipify could not complete the request. Please try again.",
};
type Code = keyof typeof messages;
const businessFailure = Symbol("resource-business-failure");
/** Expected policy decisions are values, so callers do not report them as exceptions. */
export function resourceFailure(code: Exclude<Code, "SERVICE_UNAVAILABLE">) {
	return { [businessFailure]: true as const, error: { code, message: messages[code], correlationId: randomUUID() } };
}
export function isResourceFailure(value: unknown): value is ReturnType<typeof resourceFailure> {
	return typeof value === "object" && value !== null && businessFailure in value;
}
/** Never copy an exception message, stack, request payload or ORM object. */
export function toPublicResourceError(cause: unknown) {
	const reason = cause instanceof Error ? cause.message : "";
	const candidate = reason === "REVISION_CONFLICT" ? "CONFLICT" : reason;
	const code: Code = Object.prototype.hasOwnProperty.call(messages, candidate) ? (candidate as Code) : "SERVICE_UNAVAILABLE";
	const error: { code: Code; message: string; correlationId: string; usage?: number; limit?: number } = { code, message: messages[code], correlationId: randomUUID() };
	if (code === "PLAN_LIMIT_REACHED" && cause instanceof Error) {
		const quota = cause as Error & { usage?: unknown; limit?: unknown };
		if (typeof quota.usage === "number" && Number.isSafeInteger(quota.usage) && quota.usage >= 0 && typeof quota.limit === "number" && Number.isSafeInteger(quota.limit) && quota.limit >= 0) {
			error.usage = quota.usage;
			error.limit = quota.limit;
		}
	}
	return error;
}
