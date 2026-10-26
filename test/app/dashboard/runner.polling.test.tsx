import { act, render } from "@testing-library/react";
import RunnerPage from "@/app/dashboard/runners/[id]/page";
import { getRunner, getRunnerVersionManifest, getStreamSessionsForRunner } from "@/app/actions/runner";

jest.mock("next/navigation", () => {
	const router = { push: jest.fn() };
	return { useParams: () => ({ id: "polling-runner" }), useRouter: () => router };
});
jest.mock("@/app/actions/auth", () => ({ validateAuth: jest.fn(async () => ({ id: "polling-owner" })) }));
jest.mock("@/app/actions/database", () => ({ getAllOverlays: jest.fn(async () => []) }));
jest.mock("@/app/actions/runner", () => ({
	getRunner: jest.fn(),
	getRunnerToken: jest.fn(async () => ({ success: true, token: "local-fixture-token" })),
	getRunnerLivePreview: jest.fn(async () => ({ success: true, image: null })),
	getRunnerVersionManifest: jest.fn(async () => null),
	getStreamSessionsForRunner: jest.fn(async () => []),
	listRunnerDestinations: jest.fn(async () => ({ success: true, destinations: [] })),
	listRunnerScheduleEvents: jest.fn(),
	upsertStreamSession: jest.fn(),
	setStreamDesiredState: jest.fn(),
	unlinkRunner: jest.fn(),
}));
jest.mock("@/app/lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@/app/components/upgradeModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
jest.mock("@/app/components/runner/RunnerBrandingPreview", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/runnerSchedule", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/runnerDestinations", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/runnerDestinationSelection", () => ({ __esModule: true, default: () => null, canStartWithDestinations: () => false }));
jest.mock("@/app/components/runnerBroadcastControls", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/runnerOutputStatus", () => ({ __esModule: true, default: () => null }));

afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
	jest.clearAllMocks();
});

test("TDD-US3-FR010: a slow telemetry batch cannot queue more polling ahead of schedule controls", async () => {
	jest.useFakeTimers();
	const runner = { id: "polling-runner", ownerId: "polling-owner", name: "Polling fixture", status: "offline", osInfo: null, version: null, lastHeartbeatAt: null, configurationRevision: 1 };
	jest.mocked(getRunner).mockResolvedValue(runner as never);
	const view = render(<RunnerPage />);
	await act(async () => {});
	expect(getRunner).toHaveBeenCalledTimes(1);
	let finish!: (value: Awaited<ReturnType<typeof getRunner>>) => void;
	const pending = new Promise<Awaited<ReturnType<typeof getRunner>>>((resolve) => {
		finish = resolve;
	});
	jest.mocked(getRunner).mockReturnValue(pending);
	await act(async () => {
		await jest.advanceTimersByTimeAsync(8000);
	});
	expect(getRunner).toHaveBeenCalledTimes(2);
	await act(async () => {
		finish(runner as never);
		await pending;
	});
	jest.mocked(getRunner).mockResolvedValue(runner as never);
	await act(async () => {
		await jest.advanceTimersByTimeAsync(2000);
	});
	expect(getRunner).toHaveBeenCalledTimes(3);
	view.unmount();
	await act(async () => {
		await jest.advanceTimersByTimeAsync(10000);
	});
	expect(getRunner).toHaveBeenCalledTimes(3);
});

test("UX-C3: initial transport failure shows a recoverable retry instead of an endless spinner", async () => {
	const { screen, fireEvent } = await import("@testing-library/react");
	jest.mocked(getRunner).mockRejectedValueOnce(new Error("local-fixture-offline"));
	const view = render(<RunnerPage />);
	await act(async () => {});
	expect(screen.getByRole("alert")).toHaveTextContent("Could not load this runner");
	jest.mocked(getRunner).mockResolvedValue({ id: "polling-runner", ownerId: "polling-owner", name: "Recovered runner", status: "offline" } as never);
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await act(async () => {});
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(getRunner).toHaveBeenCalledTimes(2);
	view.unmount();
});

test("first connection presents installation and Docker guidance instead of premature broadcast controls", async () => {
	const { screen } = await import("@testing-library/react");
	jest.mocked(getRunner).mockResolvedValue({ id: "polling-runner", ownerId: "polling-owner", name: "New computer", status: "offline", lastHeartbeatAt: null, osInfo: null, version: null, configurationRevision: 1 } as never);
	const view = render(<RunnerPage />);
	await act(async () => {});
	expect(screen.getByRole("heading", { name: "Setup Your Runner" })).toBeVisible();
	expect(screen.queryByRole("heading", { name: "Stream Configuration" })).not.toBeInTheDocument();
	expect(screen.getByText(/CLIPIFY_TOKEN/)).toBeInTheDocument();
	view.unmount();
});

test("connected ARM Linux shows the matching platform update state", async () => {
	const { screen } = await import("@testing-library/react");
	jest.mocked(getRunner).mockResolvedValue({ id: "polling-runner", ownerId: "polling-owner", name: "ARM computer", status: "online", lastHeartbeatAt: new Date(), osInfo: "Linux arm64", version: "a".repeat(64), configurationRevision: 1 } as never);
	jest.mocked(getRunnerVersionManifest).mockResolvedValue({ linuxArm: "a".repeat(64), linux: "b".repeat(64) } as never);
	const view = render(<RunnerPage />);
	await act(async () => {});
	expect(screen.getByRole("button", { name: "Runner up to date" })).toBeDisabled();
	view.unmount();
});

test("connection status updates even when session telemetry is still pending", async () => {
	jest.useFakeTimers();
	const { screen } = await import("@testing-library/react");
	const runner = { id: "polling-runner", ownerId: "polling-owner", name: "Connecting computer", status: "offline", lastHeartbeatAt: new Date(), osInfo: "Windows", version: null, configurationRevision: 1 };
	jest.mocked(getRunner).mockResolvedValue(runner as never);
	const view = render(<RunnerPage />);
	await act(async () => {});
	expect(screen.getByText("Offline", { exact: true })).toBeVisible();
	const manifestCalls = jest.mocked(getRunnerVersionManifest).mock.calls.length;
	jest.mocked(getRunner).mockResolvedValue({ ...runner, status: "online" } as never);
	let finish!: (sessions: Awaited<ReturnType<typeof getStreamSessionsForRunner>>) => void;
	jest.mocked(getStreamSessionsForRunner).mockReturnValueOnce(
		new Promise((resolve) => {
			finish = resolve;
		}),
	);
	await act(async () => {
		await jest.advanceTimersByTimeAsync(2000);
	});
	expect(screen.getByText("Online", { exact: true })).toBeVisible();
	expect(getRunnerVersionManifest).toHaveBeenCalledTimes(manifestCalls);
	await act(async () => {
		finish([]);
	});
	view.unmount();
});
