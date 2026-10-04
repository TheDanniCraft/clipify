import { toDeploymentId } from "./deploymentId";

export const DEPLOYMENT_ID_HEADER = "x-clipify-deployment-id";
export const DEPLOYMENT_CHECK_EVENT = "clipify:check-deployment";

export function getDeploymentId() {
	return toDeploymentId(process.env.NEXT_DEPLOYMENT_ID) || toDeploymentId(process.env.SOURCE_COMMIT) || toDeploymentId(process.env.SENTRY_RELEASE);
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
