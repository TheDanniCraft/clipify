/** @jest-environment node */
jest.mock("@sentry/nextjs", () => ({ init: jest.fn(), captureRouterTransitionStart: jest.fn(), captureRequestError: jest.fn(), withStaticSpan: (hook: unknown) => hook, browserTracingIntegration: jest.fn(), feedbackIntegration: jest.fn(), consoleLoggingIntegration: jest.fn() }));
const originalEnvironment = process.env;
beforeEach(() => {
	jest.resetModules();
	process.env = { ...originalEnvironment, NODE_ENV: "production", IS_PREVIEW: "false", E2E_TEST_MODE: "false", SENTRY_DSN: "https://public@o0.ingest.de.sentry.io/0" };
});
afterEach(() => {
	process.env = originalEnvironment;
});
it.each(["false", "true"])("disables all Sentry collection on previews even with test mode=%s", async (testMode) => {
	process.env.IS_PREVIEW = "true";
	process.env.E2E_TEST_MODE = testMode;
	const config = await import("../sentry.shared.config");
	expect(config.sentryEnabled).toBe(false);
	expect(config.sentryBrowserEnabled).toBe(false);
	for (const rate of [config.sentryTraceSampleRate, config.sentryReplaySessionSampleRate, config.sentryNodeProfileSampleRate, config.sentryBrowserProfileSampleRate]) expect(rate).toBe(0);
});
it("keeps production errors, traces and existing profile/replay rates enabled", async () => {
	const config = await import("../sentry.shared.config");
	expect(config.sentryEnabled).toBe(true);
	expect(config.sentryBrowserEnabled).toBe(true);
	expect(config.sentryTraceSampleRate).toBe(1);
	expect(config.sentryReplaySessionSampleRate).toBe(0.01);
	expect(config.sentryNodeProfileSampleRate).toBe(0.05);
	expect(config.sentryBrowserProfileSampleRate).toBe(0.001);
});
it("retains the isolated browser test SDK outside previews without a production DSN", async () => {
	process.env.E2E_TEST_MODE = "true";
	process.env.SENTRY_DSN = "";
	const config = await import("../sentry.shared.config");
	expect(config.sentryEnabled).toBe(false);
	expect(config.sentryBrowserEnabled).toBe(true);
	expect(config.sentryReplaySessionSampleRate).toBe(1);
});

it("does not initialize browser or edge Sentry for preview deployments", async () => {
	process.env.IS_PREVIEW = "true";
	process.env.NEXT_RUNTIME = "edge";
	const Sentry = await import("@sentry/nextjs");
	jest.mocked(Sentry.init).mockClear();
	const client = await import("../instrumentation-client");
	const server = await import("../src/instrumentation");
	await server.register();
	expect(Sentry.init).not.toHaveBeenCalled();
	(client.onRouterTransitionStart as (...args: unknown[]) => unknown)("/dashboard", "push");
	(server.onRequestError as (...args: unknown[]) => unknown)(new Error("preview isolation"));
	expect(Sentry.captureRouterTransitionStart).not.toHaveBeenCalled();
	expect(Sentry.captureRequestError).not.toHaveBeenCalled();
});

it("still initializes browser and edge Sentry for production", async () => {
	process.env.NEXT_RUNTIME = "edge";
	const Sentry = await import("@sentry/nextjs");
	jest.mocked(Sentry.init).mockClear();
	const client = await import("../instrumentation-client");
	const server = await import("../src/instrumentation");
	await server.register();
	expect(Sentry.init).toHaveBeenCalledTimes(2);
	expect(server.onRequestError).toBe(Sentry.captureRequestError);
	expect(client.onRouterTransitionStart).toBe(Sentry.captureRouterTransitionStart);
	expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, environment: "production" }));
});
