import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserTourProvider, useUserTour, PreviewTourCheckpoint } from "@components/user-tour/provider";
import { defaultProgress, storageKey } from "@lib/userTour";
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../../__mocks__/heroui-react.cjs");
	const Checkbox = Object.assign(({ isSelected, onChange, "aria-label": label }: any) => <input type='checkbox' aria-label={label} checked={isSelected} onChange={onChange} />, { Content: base.Checkbox.Content, Control: base.Checkbox.Control, Indicator: base.Checkbox.Indicator });
	return new Proxy({ Checkbox }, { get: (target, key) => (key === "Checkbox" ? target.Checkbox : base[key]) });
});
let currentPath = "/dashboard";
const push = jest.fn();
const track = jest.fn();
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
const mount = (accountId = "owner") =>
	render(
		<UserTourProvider accountId={accountId}>
			<Harness />
		</UserTourProvider>,
	);
beforeEach(() => {
	localStorage.clear();
	currentPath = "/dashboard";
	jest.clearAllMocks();
});
it("opens the checklist by default, minimizes and remembers independent successful actions", async () => {
	mount();
	expect(screen.getByText("Get your first overlay running")).toBeVisible();
	expect(screen.getByText("Make your overlay yours")).toBeVisible();
	expect(screen.getByText("Build a playlist")).toBeVisible();
	fireEvent.click(screen.getByText("Save successfully"));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toEqual(["overlay.name", "overlay.source"]));
	fireEvent.click(screen.getByRole("button", { name: "Minimize guide" }));
	expect(screen.getByRole("button", { name: /Get started.*2\/4/ })).toBeVisible();
});
it("starts only on request, pauses and exposes an in-progress task without claiming completion", async () => {
	mount();
	expect(screen.queryByText("Create your first overlay")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	expect(await screen.findByText("Create your first overlay")).toBeVisible();
	fireEvent.click(screen.getByText("Pause spotlight"));
	expect(screen.getByText("In progress · click to continue")).toBeVisible();
	expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toEqual([]);
});
it("loads saved progress with paused resume and keeps other accounts separate", () => {
	localStorage.setItem(storageKey("owner"), JSON.stringify({ ...defaultProgress(), completed: ["overlay.name"], active: { task: "overlay.preview", index: 0, paused: false }, overlayId: "overlay-1", minimized: false }));
	const view = mount();
	expect(screen.getByText("In progress · click to continue")).toBeVisible();
	view.unmount();
	mount("other");
	expect(screen.getByRole("button", { name: /Get started.*0\/4/ })).toBeVisible();
	expect(screen.queryByText("In progress · click to continue")).not.toBeInTheDocument();
});
it("keeps memory progress usable when storage is denied", () => {
	const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
		throw new Error("denied");
	});
	const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("denied");
	});
	mount();
	fireEvent.click(screen.getByText("Save successfully"));
	expect(screen.getByRole("button", { name: /Get started.*2\/4/ })).toBeVisible();
	read.mockRestore();
	write.mockRestore();
});
it("emits only safe identifiers for starts and completions", async () => {
	mount();
	fireEvent.click(screen.getByText("Save successfully"));
	await waitFor(() => expect(track).toHaveBeenCalledWith("guide_task_completed", { props: { journey: "overlay", task: "overlay.name" } }));
	expect(JSON.stringify(track.mock.calls)).not.toContain("overlay-1");
	expect(JSON.stringify(track.mock.calls)).not.toContain("owner");
});

it("records a pause without including resource identifiers", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	fireEvent.click(await screen.findByText("Pause spotlight"));
	expect(track).toHaveBeenCalledWith("guide_paused", { props: { journey: "overlay", task: "overlay.name" } });
});

it("keeps creation at Add Overlay when an existing resource is discovered", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	fireEvent.click(screen.getByText("Load existing overlay"));
	expect(push).not.toHaveBeenCalled();
	expect(await screen.findByText("Create your first overlay")).toBeVisible();
});

it("explains unavailable Theme Studio without starting a tour or paywall", () => {
	render(
		<UserTourProvider accountId='owner' appearanceAvailable={false}>
			<Harness />
		</UserTourProvider>,
	);
	fireEvent.click(screen.getByText("Make your overlay yours"));
	fireEvent.click(screen.getByRole("button", { name: "Customize and save your look" }));
	expect(screen.getByRole("status")).toHaveTextContent("Theme Studio requires Pro");
	expect(push).not.toHaveBeenCalled();
	expect(track).not.toHaveBeenCalledWith("guide_started", expect.anything());
});

it("completes a visible preview when matching clips finish loading", async () => {
	function PreviewHarness() {
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
					Finish loading clips
				</button>
				<PreviewTourCheckpoint ownerId='owner' overlayId='overlay-1' count={count} isOpen />
			</>
		);
	}
	render(
		<UserTourProvider accountId='owner'>
			<PreviewHarness />
		</UserTourProvider>,
	);
	fireEvent.click(screen.getByText("Finish loading clips"));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toContain("overlay.preview"));
});

it("offers an explicit way to choose a replacement for a missing overlay", async () => {
	localStorage.setItem(storageKey("owner"), JSON.stringify({ ...defaultProgress(), overlayId: "deleted", active: { task: "overlay.source", index: 1, paused: true }, minimized: false }));
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Choose another overlay" }));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).overlayId).toBeNull());
	expect(push).toHaveBeenCalledWith("/dashboard");
});

it("confirms a checkbox skip, distinguishes it from completion and supports undo", async () => {
	mount();
	const checkbox = screen.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	fireEvent.click(checkbox);
	expect(screen.getByRole("group", { name: "Skip this task?" })).toBeVisible();
	expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).skipped).toEqual([]);
	fireEvent.click(screen.getByRole("button", { name: "Skip task" }));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).skipped).toEqual(["overlay.source"]));
	expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toEqual([]);
	fireEvent.click(checkbox);
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).skipped).toEqual([]));
});
it("offers a next task after saving rather than dropping the user out of the flow", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	fireEvent.click(screen.getByText("Save successfully"));
	expect(await screen.findByRole("button", { name: "Continue: Choose your clips" })).toBeVisible();
});
it("resumes by clicking the in-progress task without resetting its step", async () => {
	localStorage.setItem(storageKey("owner"), JSON.stringify({ ...defaultProgress(), overlayId: "overlay-1", active: { task: "overlay.source", index: 1, paused: true }, minimized: false }));
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Choose your clips" }));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).active).toMatchObject({ index: 1, paused: false }));
});
it("yields to consent preferences and leaves the guide paused afterwards", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	await screen.findByText("Create your first overlay");
	fireEvent(window, new CustomEvent("clipify:consent-preferences-visibility", { detail: { visible: true } }));
	expect(screen.queryByRole("complementary", { name: "Clipify guide" })).not.toBeInTheDocument();
	fireEvent(window, new CustomEvent("clipify:consent-preferences-visibility", { detail: { visible: false } }));
	expect(await screen.findByText("In progress · click to continue")).toBeVisible();
	expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).active.paused).toBe(true);
});

it("keeps a default checklist from covering normal controls on direct editor entry", () => {
	currentPath = "/dashboard/overlay/overlay-1";
	mount();
	expect(screen.queryByRole("region", { name: "Your Clipify guide" })).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: /Get started/ })).toBeVisible();
});
it("minimizes the checklist when entering an editor without an active guide", async () => {
	const view = mount();
	currentPath = "/dashboard/overlay/overlay-1";
	view.rerender(
		<UserTourProvider accountId='owner'>
			<Harness />
		</UserTourProvider>,
	);
	await waitFor(() => expect(screen.queryByRole("region", { name: "Your Clipify guide" })).not.toBeInTheDocument());
});
