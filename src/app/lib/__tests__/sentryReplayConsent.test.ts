import { applySentryReplayConsent } from "../sentryReplayConsent";

const mockOptions: Record<string, unknown> = {};
const mockReplayStart = jest.fn();
const mockReplayStop = jest.fn();
const mockGetReplay = jest.fn();
const mockAddIntegration = jest.fn();
const mockGetIntegrationByName = jest.fn();
const mockStartProfiler = jest.fn();
const mockStopProfiler = jest.fn();
const mockReplayIntegration = jest.fn((options?: unknown) => {
	void options;
	return { name: "Replay" };
});
const mockBrowserProfilingIntegration = jest.fn(() => ({ name: "BrowserProfiling" }));
const mockGetClient = jest.fn(() => ({
	getOptions: () => mockOptions,
	getIntegrationByName: mockGetIntegrationByName,
}));

jest.mock("@sentry/nextjs", () => ({
	getClient: () => mockGetClient(),
	getReplay: () => mockGetReplay(),
	addIntegration: (integration: unknown) => mockAddIntegration(integration),
	replayIntegration: (options: unknown) => mockReplayIntegration(options),
	browserProfilingIntegration: () => mockBrowserProfilingIntegration(),
	uiProfiler: { startProfiler: () => mockStartProfiler(), stopProfiler: () => mockStopProfiler() },
}));

jest.mock("../../../../sentry.shared.config", () => ({
	sentryProfileSampleRate: 0.001,
	sentryReplaySessionSampleRate: 0.01,
}));

describe("Sentry consent lifecycle", () => {
	beforeEach(() => {
		for (const key of Object.keys(mockOptions)) delete mockOptions[key];
		jest.clearAllMocks();
		mockGetClient.mockReturnValue({ getOptions: () => mockOptions, getIntegrationByName: mockGetIntegrationByName });
		mockGetReplay.mockReturnValue(undefined);
		mockGetIntegrationByName.mockReturnValue(undefined);
	});

	it("does nothing before the Sentry client exists", async () => {
		mockGetClient.mockReturnValueOnce(undefined as never);

		await applySentryReplayConsent(true);

		expect(mockAddIntegration).not.toHaveBeenCalled();
	});

	it("stops Replay and profiling without flushing when consent is absent", async () => {
		mockGetReplay.mockReturnValue({ start: mockReplayStart, stop: mockReplayStop });

		await applySentryReplayConsent(false);

		expect(mockReplayStop).toHaveBeenCalledWith({ flush: false });
		expect(mockStopProfiler).toHaveBeenCalledTimes(1);
		expect(mockOptions).toMatchObject({ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, profileSessionSampleRate: 0 });
	});

	it("adds privacy-masked Replay and browser profiling after consent", async () => {
		await applySentryReplayConsent(true);

		expect(mockReplayIntegration).toHaveBeenCalledWith({
			maskAllText: true,
			maskAllInputs: true,
			blockAllMedia: true,
			block: ["iframe", ".sentry-block", "[data-sentry-block]"],
		});
		expect(mockAddIntegration).toHaveBeenCalledWith({ name: "Replay" });
		expect(mockAddIntegration).toHaveBeenCalledWith({ name: "BrowserProfiling" });
		expect(mockStartProfiler).toHaveBeenCalledTimes(1);
		expect(mockOptions).toMatchObject({
			replaysSessionSampleRate: 0.01,
			replaysOnErrorSampleRate: 1,
			profileSessionSampleRate: 0.001,
			profileLifecycle: "manual",
		});
	});

	it("restarts an existing Replay without adding duplicate integrations", async () => {
		mockGetReplay.mockReturnValue({ start: mockReplayStart, stop: mockReplayStop });
		mockGetIntegrationByName.mockReturnValue({ name: "BrowserProfiling" });

		await applySentryReplayConsent(true);

		expect(mockReplayStart).toHaveBeenCalledTimes(1);
		expect(mockAddIntegration).not.toHaveBeenCalled();
		expect(mockStartProfiler).toHaveBeenCalledTimes(1);
	});
});
