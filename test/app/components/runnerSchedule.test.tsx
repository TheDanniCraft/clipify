jest.mock("@/app/components/runner/BroadcastDetails", () => ({ __esModule: true, default: () => null }));
import { act, render } from "@testing-library/react";
jest.mock("@/app/components/runner/ScheduleFields", () => ({ ScheduleDateField: () => null, ScheduleTimeField: () => null, TimezonePicker: () => null }));
import RunnerSchedule from "@/app/components/runnerSchedule";
import { listRunnerScheduleEvents } from "@/app/actions/runner";

// Calendar geometry/installed widgets are browser-owned; this owner observes load cancellation.
jest.mock("@/app/components/runnerScheduleAgenda", () => ({ __esModule: true, default: ({ toolbar }: { toolbar: React.ReactNode }) => <>{toolbar}</> }));
jest.mock("@/app/actions/runner", () => ({ listRunnerScheduleEvents: jest.fn(), saveRunnerScheduleEvent: jest.fn() }));
type ReadResult = Awaited<ReturnType<typeof listRunnerScheduleEvents>>;
const paid: ReadResult = { success: true, events: [], automation: [], policy: { basicAccess: true, runnerPro: true, maxRegisteredDevices: null, maxActiveBroadcasts: null, maxTargets: null, scheduling: true, customStandby: true, attributionRequired: false, monthlyUsageLimit: null, validUntil: null, source: "pro", evaluatedAt: "2026-10-16T12:00:00.000Z", capabilityRevision: "fixture-policy-revision" } };

test("TDD-US3-FR011: a removed editor cannot publish its obsolete owner policy when a pending load resolves", async () => {
	let finish!: (value: ReadResult) => void;
	const pending = new Promise<ReadResult>((resolve) => {
		finish = resolve;
	});
	jest.mocked(listRunnerScheduleEvents).mockReturnValue(pending);
	const onPolicyChange = jest.fn();
	const view = render(<RunnerSchedule ownerId='old-owner' runnerId='old-runner' sessionId='session' overlayId='source' overlays={[]} destinations={[]} selectedDestinationIds={[]} clipPlayback onPolicyChange={onPolicyChange} />);
	expect(listRunnerScheduleEvents).toHaveBeenCalledWith("old-owner", "old-runner");
	view.unmount();
	await act(async () => {
		finish(paid);
		await pending;
	});
	expect(onPolicyChange).not.toHaveBeenCalled();
});
