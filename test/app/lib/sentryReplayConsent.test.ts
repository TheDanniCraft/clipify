/** @jest-environment node */

const getReplay = jest.fn();
const fetchMock = jest.fn();

Object.defineProperty(globalThis, "fetch", {
	configurable: true,
	writable: true,
	value: fetchMock,
});

jest.mock("@sentry/nextjs", () => ({
	getReplay: (...args: unknown[]) => getReplay(...args),
}));

jest.mock("../../../sentry.shared.config", () => ({
	sentryReplaySessionSampleRate: 0.5,
}));

type ReplayMock = {
	start: jest.Mock;
	startBuffering: jest.Mock;
	stop: jest.Mock;
};

function createReplay(): ReplayMock {
	return {
		start: jest.fn(),
		startBuffering: jest.fn(),
		stop: jest.fn().mockResolvedValue(undefined),
	};
}

function mockAdOptTags(tags?: Array<{ id: string; name: string }>) {
	fetchMock.mockResolvedValue(
		new Response(JSON.stringify({ tags }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

async function loadReplayConsent() {
	jest.resetModules();
	return import("@/app/lib/sentryReplayConsent");
}

describe("sentryReplayConsent", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	it("does nothing when the Replay integration is unavailable", async () => {
		getReplay.mockReturnValue(undefined);
		const { applySentryReplayConsent } = await loadReplayConsent();

		await applySentryReplayConsent({ optInTags: ["replay-tag"] });

		expect(getReplay).toHaveBeenCalledTimes(1);
	});

	it("keeps Replay disabled when the AdOpt replay tag is missing", async () => {
		const replay = createReplay();
		getReplay.mockReturnValue(replay);
		mockAdOptTags([{ id: "other-tag", name: "Other service" }]);
		const { applySentryReplayConsent } = await loadReplayConsent();

		await applySentryReplayConsent({ optInTags: ["other-tag"] });

		expect(replay.start).not.toHaveBeenCalled();
		expect(replay.startBuffering).not.toHaveBeenCalled();
	});

	it("starts a sampled Replay session for a matching consent tag", async () => {
		const replay = createReplay();
		getReplay.mockReturnValue(replay);
		mockAdOptTags([{ id: "replay-tag", name: "  sentry session replay  " }]);
		jest.spyOn(Math, "random").mockReturnValue(0.25);
		const { applySentryReplayConsent } = await loadReplayConsent();

		await applySentryReplayConsent({ optInTags: ["replay-tag"] });

		expect(replay.start).toHaveBeenCalledTimes(1);
		expect(replay.startBuffering).not.toHaveBeenCalled();
	});

	it("starts buffering when the consented session is outside the sample", async () => {
		const replay = createReplay();
		getReplay.mockReturnValue(replay);
		mockAdOptTags([{ id: "replay-tag", name: "Sentry Session Replay" }]);
		jest.spyOn(Math, "random").mockReturnValue(0.75);
		const { applySentryReplayConsent } = await loadReplayConsent();

		await applySentryReplayConsent({ optInTags: ["replay-tag"] });

		expect(replay.startBuffering).toHaveBeenCalledTimes(1);
		expect(replay.start).not.toHaveBeenCalled();
	});

	it("stops an active Replay after consent is withdrawn", async () => {
		const replay = createReplay();
		getReplay.mockReturnValue(replay);
		mockAdOptTags([{ id: "replay-tag", name: "Sentry Session Replay" }]);
		jest.spyOn(Math, "random").mockReturnValue(0.25);
		const { applySentryReplayConsent } = await loadReplayConsent();

		await applySentryReplayConsent({ optInTags: ["replay-tag"] });
		await applySentryReplayConsent({ optOutTags: ["replay-tag"] });

		expect(replay.stop).toHaveBeenCalledTimes(1);
	});
});
