import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserTourProvider, useUserTour, PreviewTourCheckpoint } from "@components/user-tour/provider";
import { defaultProgress, type GuideProgress } from "@lib/userTour";
jest.mock("@components/dashboardContentHost", () => ({
	__esModule: true,
	default: ({ items, onStartGuide, onDismissGuide, isVisible }: any) =>
		items.length && isVisible && onStartGuide ? (
			<div role='dialog' aria-label='Welcome'>
				<button onClick={onStartGuide}>Start guided tour</button>
				<button onClick={onDismissGuide}>Maybe later</button>
			</div>
		) : null,
}));
const save = jest.fn();
jest.mock("@actions/userTour", () => ({ saveUserTourEvent: (...args: unknown[]) => save(...args) }));
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../../__mocks__/heroui-react.cjs");
	const Checkbox = Object.assign(({ isSelected, isIndeterminate, onChange, "aria-label": label }: any) => <input type='checkbox' aria-label={label} aria-checked={isIndeterminate ? "mixed" : isSelected} checked={Boolean(isSelected)} onChange={onChange} />, { Content: base.Checkbox.Content, Control: base.Checkbox.Control, Indicator: base.Checkbox.Indicator });
	const Open = React.createContext(false);
	const Popover = Object.assign(({ isOpen, children }: any) => <Open.Provider value={isOpen}>{children}</Open.Provider>, {
		Content: ({ children }: any) => (React.useContext(Open) ? <div>{children}</div> : null),
		Dialog: ({ children, ...props }: any) => (
			<div role='dialog' data-slot='popover-dialog' {...props}>
				{children}
			</div>
		),
		Heading: base.Label,
	});
	const Circle = Object.assign(
		({ children, value, "aria-label": label }: any) => (
			<div role='progressbar' aria-label={label} aria-valuenow={value}>
				{children}
			</div>
		),
		{ Track: base.ProgressCircle.Track, TrackCircle: base.ProgressCircle.TrackCircle, FillCircle: base.ProgressCircle.FillCircle },
	);
	return new Proxy({ Checkbox, Popover, ProgressCircle: Circle }, { get: (target: any, key) => (key in target ? target[key] : base[key]) });
});
let currentPath = "/dashboard";
const push = jest.fn(),
	track = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => currentPath, useRouter: () => ({ push }) }));
jest.mock("next-plausible", () => ({ usePlausible: () => track }));
jest.mock("@components/user-tour/spotlight", () => ({
	__esModule: true,
	default: ({ step, onPause, onNext }: any) => (
		<div>
			<p>{step.title}</p>
			<button onClick={onPause}>Pause spotlight</button>
			<button onClick={onNext}>Pointer next</button>
		</div>
	),
}));
function Harness() {
	const { report } = useUserTour();
	return (
		<>
			<button onClick={() => report({ type: "overlay.ready", ownerId: "owner", id: "overlay-1" })}>Load existing overlay</button>
			<button onClick={() => report({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: true, source: true })}>Save successfully</button>
		</>
	);
}
const mount = (initialProgress = defaultProgress(), accountId = "owner") =>
	render(
		<UserTourProvider accountId={accountId} initialProgress={initialProgress}>
			<Harness />
		</UserTourProvider>,
	);
beforeEach(() => {
	jest.clearAllMocks();
	currentPath = "/dashboard";
	localStorage.clear();
	save.mockImplementation(async (accountId: string) => ({ ok: true, accountId }));
});
it("opens a first-use checklist with a ring and four concise sections", () => {
	mount();
	expect(screen.getByRole("region", { name: "Your Clipify guide" })).toBeVisible();
	expect(screen.getByRole("progressbar", { name: "Get your first overlay running progress" })).toHaveAttribute("aria-valuenow", "0");
	expect(screen.getByText("Explore Clipify")).toBeVisible();
	expect(screen.queryByText(/Progress is saved|Need a hand|click to replay|click to continue/)).not.toBeInTheDocument();
});
it("uses the server snapshot after browser storage is cleared", () => {
	const state: GuideProgress = { ...defaultProgress(), completed: ["overlay.name", "overlay.source"], minimized: true };
	const view = mount(state);
	view.unmount();
	localStorage.clear();
	mount(state);
	expect(screen.getByRole("button", { name: /Get started.*50%/ })).toBeVisible();
	expect(screen.queryByRole("region", { name: "Your Clipify guide" })).not.toBeInTheDocument();
});
it("starts replay at the navigation control without calling router.push", async () => {
	currentPath = "/dashboard/overlay/overlay-1";
	mount({ ...defaultProgress(), overlayId: "overlay-1", completed: ["overlay.name"] });
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	expect(await screen.findByText("Open your Dashboard")).toBeVisible();
	expect(push).not.toHaveBeenCalled();
});
it("persists successful owned events through an ordered account-scoped action queue", async () => {
	mount();
	fireEvent.click(screen.getByText("Load existing overlay"));
	fireEvent.click(screen.getByText("Save successfully"));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", expect.objectContaining({ type: "overlay.saved" })));
	expect(save.mock.calls[0][1].type).toBe("overlay.ready");
	expect(save.mock.calls[1][1].type).toBe("overlay.saved");
});
it("opens a popover for skipping and does not skip on cancel or a second request", async () => {
	mount();
	const checkbox = screen.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	fireEvent.click(checkbox);
	expect(screen.getByRole("dialog", { name: "Skip Choose your clips?" })).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(checkbox).not.toBeChecked();
	fireEvent.click(checkbox);
	expect(checkbox).not.toBeChecked();
	fireEvent.click(screen.getByRole("button", { name: "Skip task" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", { type: "task.skip", task: "overlay.source" }));
	expect(checkbox).toBeChecked();
	fireEvent.click(checkbox);
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", { type: "task.restore", task: "overlay.source" }));
});
it("represents a paused task with an indeterminate checkbox instead of status chips", async () => {
	mount({ ...defaultProgress(), overlayId: "overlay-1", active: { task: "overlay.source", index: 1, paused: true, navigation: [] } });
	expect(screen.getByRole("checkbox", { name: "Mark Choose your clips as done" })).toBePartiallyChecked();
	expect(screen.queryByText(/In progress|Choose another/)).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Choose your clips" }));
	expect(push).not.toHaveBeenCalled();
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", { type: "resume", location: "dashboard", pickerOpen: false }));
});
it("continues from a saved name into clip selection without a completion card", async () => {
	currentPath = "/dashboard/overlay/overlay-1";
	mount({ ...defaultProgress(), overlayId: "overlay-1", active: { task: "overlay.name", index: 2, paused: false, navigation: [] } });
	fireEvent.click(screen.getByText("Save successfully"));
	expect(await screen.findByText("Choose your clips")).toBeVisible();
	expect(screen.queryByText(/done\.|Continue:/)).not.toBeInTheDocument();
});
it("keeps save failures visible and allows retry without losing queued events", async () => {
	save.mockRejectedValueOnce(new Error("offline"));
	mount();
	fireEvent.click(screen.getByText("Save successfully"));
	expect(await screen.findByText("Could not save progress.")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await waitFor(() => expect(screen.queryByText("Could not save progress.")).not.toBeInTheDocument());
	expect(save).toHaveBeenCalledTimes(2);
});
it("keeps another account's snapshot isolated", () => {
	const view = mount({ ...defaultProgress(), completed: ["overlay.name"], minimized: true });
	view.unmount();
	mount(defaultProgress(), "other");
	expect(screen.getByRole("button", { name: /Get started.*0%/ })).toBeVisible();
});
it("honors unavailable Theme Studio without navigating or forcing an upgrade", () => {
	render(
		<UserTourProvider accountId='owner' appearanceAvailable={false}>
			<Harness />
		</UserTourProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Customize your look" }));
	expect(screen.getByRole("status")).toHaveTextContent("Theme Studio requires Pro.");
	expect(push).not.toHaveBeenCalled();
});
it("yields to consent preferences and leaves the pointer paused", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	await screen.findByText("Open Overlays");
	fireEvent(window, new CustomEvent("clipify:consent-preferences-visibility", { detail: { visible: true } }));
	expect(screen.queryByRole("complementary", { name: "Clipify guide" })).not.toBeInTheDocument();
	fireEvent(window, new CustomEvent("clipify:consent-preferences-visibility", { detail: { visible: false } }));
	expect(screen.getByRole("checkbox", { name: "Mark Create and name your overlay as done" })).toBePartiallyChecked();
});
it("emits only safe task identifiers for successful actions", async () => {
	mount();
	fireEvent.click(screen.getByText("Save successfully"));
	await waitFor(() => expect(track).toHaveBeenCalledWith("guide_task_completed", { props: { journey: "overlay", task: "overlay.name" } }));
	expect(JSON.stringify(track.mock.calls)).not.toContain("overlay-1");
});
it("recognizes a nonempty preview after asynchronous loading", async () => {
	function Preview() {
		const { report } = useUserTour();
		const [count, setCount] = React.useState(0);
		return (
			<>
				<button
					onClick={() => {
						report({ type: "overlay.ready", ownerId: "owner", id: "overlay-1" });
						setCount(2);
					}}
				>
					Load clips
				</button>
				<PreviewTourCheckpoint ownerId='owner' overlayId='overlay-1' count={count} isOpen />
			</>
		);
	}
	render(
		<UserTourProvider accountId='owner'>
			<Preview />
		</UserTourProvider>,
	);
	fireEvent.click(screen.getByText("Load clips"));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", expect.objectContaining({ type: "overlay.previewed", count: 2 })));
});

it("does not restore launcher focus over a newly opened skip popover", () => {
	jest.useFakeTimers();
	currentPath = "/dashboard/overlay/overlay-1";
	mount({ ...defaultProgress(), overlayId: "overlay-1", minimized: false, active: { task: "overlay.source", index: 0, paused: false, navigation: [] } });
	const launcher = screen.getByRole("button", { name: /Get started/ });
	const focus = jest.spyOn(launcher, "focus");
	fireEvent.click(screen.getByText("Pause spotlight"));
	fireEvent.click(screen.getByRole("checkbox", { name: "Mark Choose your clips as done" }));
	act(() => jest.runOnlyPendingTimers());
	expect(focus).not.toHaveBeenCalled();
	focus.mockRestore();
	jest.useRealTimers();
});
it("shows the last section's own count after reload instead of Guides or core progress", () => {
	mount({ ...defaultProgress(), journeyId: "appearance", completed: ["overlay.name", "overlay.source", "overlay.preview", "overlay.setup", "appearance.style"], minimized: true });
	const launcher = screen.getByRole("button", { name: "Make your overlay yours · 100%" });
	expect(launcher).toHaveTextContent("100%");
	expect(screen.queryByText("Guides")).not.toBeInTheDocument();
	expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
});

it("retains completed task credit while the next task is in progress", () => {
	mount({ ...defaultProgress(), overlayId: "overlay-1", completed: ["overlay.name"], active: { task: "overlay.source", index: 0, paused: true } });
	expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
	expect(screen.getByRole("button", { name: "Get started · 38%" })).toHaveTextContent("38%");
});

it("keeps the ring percentage format when a task finishes", () => {
	const view = mount({ ...defaultProgress(), completed: ["overlay.name"], minimized: true });
	expect(screen.getByRole("button", { name: "Get started · 25%" })).toHaveTextContent("25%");
	view.unmount();
	mount({ ...defaultProgress(), completed: ["overlay.name", "overlay.source"], minimized: true });
	expect(screen.getByRole("button", { name: "Get started · 50%" })).toHaveTextContent("50%");
});

it("starts the first unfinished task from the welcome dialog without routing the user", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Start guided tour" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", { type: "welcome.start", location: "dashboard" }));
	expect(screen.queryByRole("dialog", { name: "Welcome" })).not.toBeInTheDocument();
	expect(push).not.toHaveBeenCalled();
});
it("remembers Maybe later and does not offer the welcome to returning accounts", async () => {
	const view = mount();
	fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", { type: "welcome.dismiss" }));
	expect(screen.queryByRole("dialog", { name: "Welcome" })).not.toBeInTheDocument();
	view.unmount();
	mount({ ...defaultProgress(), welcomeSeen: true });
	expect(screen.queryByRole("dialog", { name: "Welcome" })).not.toBeInTheDocument();
});

it("shows actual Expert completion separately from checked skipped tasks", () => {
	mount({ ...defaultProgress(), welcomeSeen: true, completed: ["overlay.name"], skipped: ["overlay.source"] });
	expect(screen.getByLabelText("Clipify Expert progress")).toHaveTextContent("Clipify Expert: 1/11");
	expect(screen.getByText("Skipped")).toBeVisible();
	expect(screen.getByRole("button", { name: "Choose your clips" })).toHaveTextContent("Skipped");
});
