/** @jest-environment node */
import { getDeploymentId, isMissingServerActionError, requestDeploymentCheck } from "@/app/lib/deployment";
const keys = ["NEXT_DEPLOYMENT_ID", "SOURCE_COMMIT", "SENTRY_RELEASE"] as const;
let previous: Record<string, string | undefined>;
beforeEach(() => {
	previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	for (const key of keys) delete process.env[key];
});
afterEach(() => {
	for (const key of keys)
		if (previous[key] === undefined) delete process.env[key];
		else process.env[key] = previous[key];
});

test("the explicit Next deployment ID takes priority over fallback identifiers", () => {
	Object.assign(process.env, { NEXT_DEPLOYMENT_ID: "current-deploy", SOURCE_COMMIT: "old-commit", SENTRY_RELEASE: "old-release" });
	expect(getDeploymentId()).toBe("current-deploy");
});
test("the source commit identifies recovery when an explicit deployment ID is absent", () => {
	Object.assign(process.env, { SOURCE_COMMIT: "current-commit", SENTRY_RELEASE: "old-release" });
	expect(getDeploymentId()).toBe("current-commit");
});
test("a release identifier supports recovery when build and commit IDs are absent", () => {
	process.env.SENTRY_RELEASE = "clipify@v2.3.4+abc123";
	expect(getDeploymentId()).toBe("clipify-v2-3-4-abc123");
});
test("non-error data cannot request missing-action recovery", () => {
	expect(isMissingServerActionError({ message: "Failed to find Server Action" })).toBe(false);
	const error = new Error("Action unavailable");
	error.name = "UnrecognizedActionError";
	expect(isMissingServerActionError(error)).toBe(true);
});
test("server-side deployment recovery does not access a browser window", () => {
	expect(typeof window).toBe("undefined");
	expect(() => requestDeploymentCheck()).not.toThrow();
});
