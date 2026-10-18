import { act, render } from "@testing-library/react";
import RunnerPage from "@/app/dashboard/runners/[id]/page";
import { getRunner } from "@/app/actions/runner";

jest.mock("next/navigation", () => ({ useParams: () => ({ id: "polling-runner" }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/app/actions/auth", () => ({ validateAuth: jest.fn(async () => ({ id: "polling-owner" })) }));
jest.mock("@/app/actions/database", () => ({ getAllOverlays: jest.fn(async () => []) }));
jest.mock("@/app/actions/runner", () => ({ getRunner: jest.fn(), getRunnerToken: jest.fn(async () => ({ success: true, token: "local-fixture-token" })), getRunnerVersionManifest: jest.fn(async () => null), getStreamSessionsForRunner: jest.fn(async () => []), listRunnerDestinations: jest.fn(async () => ({ success: true, destinations: [] })), listRunnerScheduleEvents: jest.fn(), upsertStreamSession: jest.fn(), setStreamDesiredState: jest.fn(), unlinkRunner: jest.fn() }));
jest.mock("@/app/lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@/app/components/dashboardNavbar", () => ({ __esModule: true, default: () => null }));
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
