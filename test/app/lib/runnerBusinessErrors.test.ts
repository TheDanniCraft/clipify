/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { captureUnexpectedError } from "@/app/lib/sentryServer";

jest.mock("@sentry/nextjs", () => ({
	withScope: jest.fn((run) => run({ setTag: jest.fn() })),
	captureException: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test.each(["RUNNER_TARGET_LIMIT", "FEATURE_RESTRICTED", "RESOURCE_IN_USE", "RUNNER_INGEST_IN_USE", "RUNNER_CONCURRENCY_LIMIT", "RUNNER_RECOVERY_REQUIRED", "REVISION_CONFLICT", "ACCESS_DENIED", "INVALID_INPUT"])("expected Runner denial %s does not become a Sentry issue", (code) => {
	captureUnexpectedError(new Error(code), "runner-actions", "set-stream-state");
	expect(Sentry.captureException).not.toHaveBeenCalled();
	expect(Sentry.withScope).not.toHaveBeenCalled();
});

test("unexpected infrastructure failures still reach Sentry", () => {
	const failure = new Error("database connection lost");
	captureUnexpectedError(failure, "runner-actions", "set-stream-state");
	expect(Sentry.captureException).toHaveBeenCalledWith(failure);
});

test("unknown exceptions cannot hide behind prototype error-code names", () => {
	const failure = new Error("constructor");
	captureUnexpectedError(failure, "runner-actions", "set-stream-state");
	expect(Sentry.captureException).toHaveBeenCalledWith(failure);
});

test("classification is limited to Runner actions and cannot suppress an unrelated component failure", () => {
	const failure = new Error("INVALID_INPUT");
	captureUnexpectedError(failure, "billing", "webhook");
	expect(Sentry.captureException).toHaveBeenCalledWith(failure);
});
