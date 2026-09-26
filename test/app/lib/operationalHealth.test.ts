/** @jest-environment node */
export {};

const dbSelect = jest.fn();
const metricCount = jest.fn();
const metricGauge = jest.fn();
const metricDistribution = jest.fn();
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const captureException = jest.fn();

jest.mock("@/db/client", () => ({
	db: { select: (...args: unknown[]) => dbSelect(...args) },
}));

jest.mock("@sentry/nextjs", () => ({
	metrics: {
		count: (...args: unknown[]) => metricCount(...args),
		gauge: (...args: unknown[]) => metricGauge(...args),
		distribution: (...args: unknown[]) => metricDistribution(...args),
	},
	logger: {
		info: (...args: unknown[]) => loggerInfo(...args),
		warn: (...args: unknown[]) => loggerWarn(...args),
	},
	captureException: (...args: unknown[]) => captureException(...args),
}));

function makeQuery(rows: unknown[]) {
	const query = {
		from: () => query,
		groupBy: () => query,
		then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
	};
	return query;
}

function queueDatabaseResults(results: unknown[][]) {
	const pending = [...results];
	dbSelect.mockImplementation(() => makeQuery(pending.shift() ?? []));
}

async function loadOperationalHealth() {
	return import("@/app/lib/operationalHealth");
}

describe("lib/operationalHealth", () => {
	const originalEnv = process.env;

	beforeEach(async () => {
		jest.clearAllMocks();
		process.env = { ...originalEnv, NODE_ENV: "test" };
		const { resetOperationalHealthForTests } = await loadOperationalHealth();
		resetOperationalHealthForTests();
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("logs a minute snapshot without sending Sentry metrics in preview", async () => {
		process.env = { ...originalEnv, NODE_ENV: "production", IS_PREVIEW: "true" };
		const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);
		const now = Date.parse("2026-09-26T12:00:00.000Z");
		queueDatabaseResults([[{ key: "overlay-1", depth: 3, oldestQueuedAt: new Date(now - 30_000) }], [{ key: "owner-1", depth: 2, oldestQueuedAt: new Date(now - 60_000) }], [{ total: 2, online: 1 }], [{ total: 3, desiredRunning: 2, actuallyRunning: 1, errored: 1 }]]);

		try {
			const { publishOperationalHealthSnapshot, recordOverlayStateUpdate, recordWebSocketSubscribed } = await loadOperationalHealth();
			const client = {};
			recordWebSocketSubscribed(client, "overlay-1", "owner-1", "overlay", now);
			recordOverlayStateUpdate(client, { kind: "heartbeat", playerAttached: true, showPlayer: true, paused: false, standby: false, currentClipId: "clip-1" }, now);
			recordOverlayStateUpdate(client, { kind: "now_playing", clipId: "clip-1", currentTime: 2 }, now);

			const snapshot = await publishOperationalHealthSnapshot(now);

			expect(snapshot.environment).toBe("preview");
			expect(snapshot.overlays.eligible).toBe(1);
			expect(snapshot.queues.viewer.active.depth).toBe(3);
			expect(snapshot.queues.moderator.active.depth).toBe(2);
			expect(metricGauge).not.toHaveBeenCalled();
			expect(metricCount).not.toHaveBeenCalled();
			expect(consoleInfo).toHaveBeenCalledWith("[OperationalHealth] minute snapshot", expect.any(String));
		} finally {
			consoleInfo.mockRestore();
		}
	});

	it("keeps backlog dormant when no eligible overlay is open", async () => {
		process.env = { ...originalEnv, NODE_ENV: "test" };
		const now = Date.parse("2026-09-26T12:00:00.000Z");
		queueDatabaseResults([[{ key: "closed-overlay", depth: 9, oldestQueuedAt: new Date(now - 86_400_000) }], [{ key: "offline-owner", depth: 4, oldestQueuedAt: new Date(now - 86_400_000) }], [{ total: 0, online: 0 }], [{ total: 0, desiredRunning: 0, actuallyRunning: 0, errored: 0 }]]);

		const { publishOperationalHealthSnapshot } = await loadOperationalHealth();
		const snapshot = await publishOperationalHealthSnapshot(now);

		expect(snapshot.queues.viewer.dormant).toEqual(expect.objectContaining({ consumers: 1, depth: 9 }));
		expect(snapshot.queues.viewer.stalled.depth).toBe(0);
		expect(snapshot.queues.moderator.dormant.depth).toBe(4);
	});

	it("reports only aggregated metrics to Sentry in production", async () => {
		process.env = { ...originalEnv, NODE_ENV: "production", IS_PREVIEW: "false" };
		queueDatabaseResults([[], [], [{ total: 1, online: 1 }], [{ total: 1, desiredRunning: 1, actuallyRunning: 1, errored: 0 }]]);

		const { operationalCount, operationalDuration, publishOperationalHealthSnapshot } = await loadOperationalHealth();
		operationalCount("clipify.auth.callback", 2, { outcome: "success" });
		operationalDuration("clipify.auth.callback_duration", 100, { outcome: "success" });
		operationalDuration("clipify.auth.callback_duration", 300, { outcome: "success" });

		await publishOperationalHealthSnapshot(Date.parse("2026-09-26T12:00:00.000Z"));

		expect(metricCount).toHaveBeenCalledWith("clipify.auth.callback", 2, { attributes: { outcome: "success" } });
		expect(metricDistribution).toHaveBeenCalledWith("clipify.auth.callback_duration", 200, {
			unit: "millisecond",
			attributes: { outcome: "success", aggregation: "average" },
		});
		expect(metricGauge).toHaveBeenCalledWith("clipify.runner.nodes", 1, { attributes: { state: "online" } });
	});
});
