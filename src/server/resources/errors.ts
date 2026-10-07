import { randomUUID } from "node:crypto";
const messages = {
	INVALID_INPUT: "Check your input and fetch the current page again.",
	ACCESS_DENIED: "Your current permissions do not allow this operation.",
	RESOURCE_UNAVAILABLE: "This resource is unavailable.",
	FEATURE_RESTRICTED: "Your creator’s current plan does not include this capability.",
	PLAN_LIMIT_REACHED: "Your creator has reached the current plan limit.",
	CONFLICT: "This resource changed. Read its current configuration before editing again.",
	RETRY_CONFLICT: "This retry key was already used for a different request.",
	RATE_LIMITED: "Too many requests. Try again later.",
	SERVICE_UNAVAILABLE: "Clipify could not complete the request. Please try again.",
};
type Code = keyof typeof messages;
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
