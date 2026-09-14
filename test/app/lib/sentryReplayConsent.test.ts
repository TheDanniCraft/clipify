/** @jest-environment node */

const getClient = jest.fn();
const getReplay = jest.fn();
const addIntegration = jest.fn();
const replayIntegration = jest.fn((_options: unknown) => ({ name: "Replay" }));
const getOptions = jest.fn(() => ({ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 }));

jest.mock("@sentry/nextjs", () => ({
	getClient: (...args: unknown[]) => getClient(...args),
	getReplay: (...args: unknown[]) => getReplay(...args),
	addIntegration: (...args: unknown[]) => addIntegration(...args),
	replayIntegration: (options: unknown) => replayIntegration(options),
}));

jest.mock("../../../sentry.shared.config", () => ({
	sentryReplaySessionSampleRate: 0.5,
}));

async function loadReplayConsent() {
	jest.resetModules();
	return import("@/app/lib/sentryReplayConsent");
}

describe("sentryReplayConsent", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getClient.mockReturnValue({ getOptions });
		getReplay.mockReturnValue(undefined);
		getOptions.mockReturnValue({ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
	});

	it("does nothing when Sentry has no client", async () => {
		getClient.mockReturnValue(undefined);
		const { applySentryReplayConsent } = await loadReplayConsent();
		await applySentryReplayConsent(true);
		expect(addIntegration).not.toHaveBeenCalled();
	});

	it("never starts Replay without measurement consent", async () => {
		const { applySentryReplayConsent } = await loadReplayConsent();
		await applySentryReplayConsent(false);
		expect(addIntegration).not.toHaveBeenCalled();
	});

	it("adds a masked Replay integration only after measurement consent", async () => {
		const { applySentryReplayConsent } = await loadReplayConsent();
		await applySentryReplayConsent(true);
		expect(getOptions()).toEqual({ replaysSessionSampleRate: 0.5, replaysOnErrorSampleRate: 1 });
		expect(replayIntegration).toHaveBeenCalledWith(expect.objectContaining({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }));
		expect(addIntegration).toHaveBeenCalledTimes(1);
	});

	it("does not add Replay twice", async () => {
		getReplay.mockReturnValue({ stop: jest.fn() });
		const { applySentryReplayConsent } = await loadReplayConsent();
		await applySentryReplayConsent(true);
		expect(addIntegration).not.toHaveBeenCalled();
	});

	it("stops Replay without flushing after consent is withdrawn", async () => {
		const stop = jest.fn().mockResolvedValue(undefined);
		getReplay.mockReturnValue({ stop });
		const { applySentryReplayConsent } = await loadReplayConsent();
		await applySentryReplayConsent(false);
		expect(stop).toHaveBeenCalledWith({ flush: false });
	});
});
