import React from "react";
import { act, render, screen } from "@testing-library/react";
import AdminHealthCharts from "@/app/components/adminHealthCharts";
import type { InstanceHealthSnapshot } from "@/app/lib/instanceHealth";

jest.mock("@heroui/react", () => ({
	Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
	CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
	CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	BarChart: ({ children, width }: { children: React.ReactNode; width?: number }) => <div data-testid='bar-chart' data-width={String(width ?? "")}>{children}</div>,
	Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Cell: () => null,
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	PieChart: ({ children, width }: { children: React.ReactNode; width?: number }) => <div data-testid='pie-chart' data-width={String(width ?? "")}>{children}</div>,
	Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	RadialBarChart: ({ children, width }: { children: React.ReactNode; width?: number }) => <div data-testid='radial-chart' data-width={String(width ?? "")}>{children}</div>,
	PolarAngleAxis: () => null,
	RadialBar: () => null,
}));

const healthSnapshot: InstanceHealthSnapshot = {
	status: "ok",
	time: "2026-03-09T00:00:00.000Z",
	uptimeSec: 1200,
	app: { env: "test", version: "abc123" },
	counts: {
		users: 10,
		usersFree: 7,
		usersPaid: 3,
		activeUsers24h: 5,
		activeUsers7d: 8,
		activeUsers30d: 10,
		overlaysTotal: 20,
		overlaysActive: 15,
		overlaysPaused: 5,
		activeOverlayOwnersFree: 4,
		activeOverlayOwnersPaid: 3,
	},
	accounts: {
		disabledUsers: 1,
		disabledManual: 1,
		disabledAutomatic: 0,
		neverLoggedIn: 2,
		disabledReasonCounts: {
			abuse: 1,
		},
	},
	playlists: {
		total: 4,
		nonEmpty: 3,
		empty: 1,
		clipRows: 24,
		avgClipsPerPlaylist: 6,
		overlaysWithPlaylist: 7,
		activeOverlaysWithPlaylist: 5,
	},
	newsletter: {
		settingsRows: 10,
		optedIn: 8,
		optedOut: 2,
		consentSourceCounts: {
			soft_opt_in_default: 6,
			settings_page_explicit_optin: 2,
			settings_page_optout: 2,
		},
		optedOutReasonCounts: {
			settings_page_optout: 2,
		},
	},
	queues: {
		clipQueueDepth: 3,
		modQueueDepth: 1,
	},
	auth: {
		tokenRows: 10,
		expiredTokens: 0,
		expiringIn24h: 2,
	},
	entitlements: {
		activeGrantUsers: 1,
		activeGrantUsersOnFree: 1,
		activeGrantCount: 2,
		effectiveProUsersEstimate: 4,
		grantsBySource: { manual: 1 },
		grantsByEntitlement: { pro: 2 },
	},
	cache: {
		entriesTotal: 1000,
		clipEntries: 900,
		avatarEntries: 50,
		gameEntries: 50,
		unavailableClips: 10,
		clipSyncStates: 12,
		clipSyncComplete: 9,
		backfillCompleteRatio: 0.75,
		staleValidatedClips: 3,
		globalReadHitRate: 0.824,
		globalReadTotal: 100,
		globalReadHits: 82,
		globalReadMisses: 18,
		globalStaleHits: 6,
		cacheReadMetricsStartedAt: "2026-03-08T00:00:00.000Z",
		lastCacheReadAt: "2026-03-09T00:00:00.000Z",
	},
	scheduler: {
		clipCache: {
			startedAt: "2026-03-08T00:00:00.000Z",
			intervalMs: 60000,
			batchSize: 25,
			lastRunAt: "2026-03-09T00:00:00.000Z",
			lastRunDurationMs: 150,
			lastRunOwnerCount: 12,
			totalRuns: 10,
			totalFailures: 0,
			lastError: null,
		},
	},
	db: {
		ok: true,
		latencyMs: 42,
	},
};

class MockResizeObserver {
	observe = jest.fn();
	disconnect = jest.fn();
	unobserve = jest.fn();
}

describe("components/adminHealthCharts", () => {
	let originalResizeObserver: typeof global.ResizeObserver;

	beforeEach(() => {
		originalResizeObserver = global.ResizeObserver;
		global.ResizeObserver = MockResizeObserver as unknown as typeof global.ResizeObserver;
		jest.clearAllMocks();
	});

	afterEach(() => {
		global.ResizeObserver = originalResizeObserver;
	});

	it("renders chart sections and key percentages", () => {
		render(<AdminHealthCharts health={healthSnapshot} />);

		expect(screen.getByText("Active Users Trend")).toBeInTheDocument();
		expect(screen.getByText("Overlay Distribution")).toBeInTheDocument();
		expect(screen.getByText("Health Gauges")).toBeInTheDocument();
		expect(screen.getByText("82.4%")).toBeInTheDocument();
		expect(screen.getByText("75.0%")).toBeInTheDocument();
	});

	it("measures width and renders chart nodes with numeric widths", async () => {
		const boxSpy = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 600,
			height: 220,
			top: 0,
			left: 0,
			right: 600,
			bottom: 220,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
		const rafSpy = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});

		render(<AdminHealthCharts health={healthSnapshot} />);
		expect(await screen.findAllByTestId("bar-chart")).not.toHaveLength(0);
		expect(screen.getAllByTestId("bar-chart")[0]).toHaveAttribute("data-width", "600");

		rafSpy.mockRestore();
		boxSpy.mockRestore();
	});

	it("handles missing ResizeObserver gracefully", () => {
		// @ts-expect-error - Testing missing global ResizeObserver
		delete global.ResizeObserver;
		const rafSpy = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});

		render(<AdminHealthCharts health={healthSnapshot} />);
		rafSpy.mockRestore();
	});

	it("handles edge cases for scheduler data (zero runs, failures)", () => {
		const zeroHealth: InstanceHealthSnapshot = {
			...healthSnapshot,
			scheduler: {
				clipCache: {
					...healthSnapshot.scheduler.clipCache,
					totalRuns: 0,
					totalFailures: 0,
					lastRunDurationMs: null,
				},
			},
			counts: {
				...healthSnapshot.counts,
				users: 5,
				activeUsers30d: 10, // results in negative inactiveUsers which is handled by Math.max(0, ...)
			},
		};

		render(<AdminHealthCharts health={zeroHealth} />);
		expect(screen.getByText("Success: 0")).toBeInTheDocument();
		expect(screen.getByText("Failures: 0")).toBeInTheDocument();
	});

	it("handles ResizeObserver callback", () => {
		const observerCallbacks: Array<(entries: Array<{ contentRect: { width: number }; target: { getBoundingClientRect: () => { width: number } } }>) => void> = [];
		global.ResizeObserver = jest.fn().mockImplementation((cb) => {
			observerCallbacks.push(cb);
			return {
				observe: jest.fn(),
				disconnect: jest.fn(),
				unobserve: jest.fn(),
			};
		}) as unknown as typeof global.ResizeObserver;

		render(<AdminHealthCharts health={healthSnapshot} />);

		// Simulate resize for all observers
		act(() => {
			for (const cb of observerCallbacks) {
				cb([{ contentRect: { width: 800 }, target: { getBoundingClientRect: () => ({ width: 800 }) } }]);
			}
		});

		expect(screen.getAllByTestId("radial-chart")[0]).toHaveAttribute("data-width", "800");
	});
});
