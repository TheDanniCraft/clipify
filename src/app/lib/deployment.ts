export const DEPLOYMENT_ID_HEADER = "x-clipify-deployment-id";
export const DEPLOYMENT_CHECK_EVENT = "clipify:check-deployment";

function normalizeDeploymentId(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

export function getDeploymentId() {
	return normalizeDeploymentId(process.env.NEXT_DEPLOYMENT_ID) || normalizeDeploymentId(process.env.SENTRY_RELEASE) || normalizeDeploymentId(process.env.SOURCE_COMMIT);
}

export function isLongLivedRuntimePath(pathname: string) {
	return [/^\/embed\/[^/]+\/?$/, /^\/overlay\/[^/]+\/?$/, /^\/controller\/[^/]+\/?$/, /^\/gallery\/[^/]+\/(?:frame|clip\/[^/]+)\/?$/, /^\/dashboard\/galleries\/[^/]+\/preview\/clip\/[^/]+\/?$/, /^\/demoPlayer\/?$/].some((pattern) => pattern.test(pathname));
}

export function isMissingServerActionError(value: unknown) {
	if (!(value instanceof Error)) return false;
	return value.name === "UnrecognizedActionError" || value.message.includes("Failed to find Server Action") || (value.message.includes("Server Action") && value.message.includes("was not found on the server"));
}

export function requestDeploymentCheck() {
	if (typeof window !== "undefined") window.dispatchEvent(new Event(DEPLOYMENT_CHECK_EVENT));
}
