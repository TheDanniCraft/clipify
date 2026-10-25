import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserTourProvider, useUserTour, PreviewTourCheckpoint } from "@components/user-tour/provider";
import { defaultProgress, storageKey } from "@lib/userTour";
const push = jest.fn();
const track = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push }) }));
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
	jest.clearAllMocks();
});
it("opens three sections, minimizes and remembers independent successful actions", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
	expect(screen.getByText("Get your first overlay running")).toBeVisible();
	expect(screen.getByText("Make your overlay yours")).toBeVisible();
	expect(screen.getByText("Build a playlist")).toBeVisible();
	fireEvent.click(screen.getByText("Save successfully"));
	await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toEqual(["overlay.name", "overlay.source"]));
	fireEvent.click(screen.getByRole("button", { name: "Minimize guide" }));
	expect(screen.getByRole("button", { name: /Get started.*2\/4/ })).toBeVisible();
});
it("starts only on request, pauses and exposes resume without claiming completion", async () => {
	mount();
	expect(screen.queryByText("Create your first overlay")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	expect(await screen.findByText("Create your first overlay")).toBeVisible();
	fireEvent.click(screen.getByText("Pause spotlight"));
	expect(screen.getByRole("button", { name: "Resume guide" })).toBeVisible();
	expect(JSON.parse(localStorage.getItem(storageKey("owner"))!).completed).toEqual([]);
});
it("loads saved progress with paused resume and keeps other accounts separate", () => {
	localStorage.setItem(storageKey("owner"), JSON.stringify({ ...defaultProgress(), completed: ["overlay.name"], active: { task: "overlay.preview", index: 0, paused: false }, overlayId: "overlay-1", minimized: false }));
	const view = mount();
	expect(screen.getByRole("button", { name: "Resume guide" })).toBeVisible();
	view.unmount();
	mount("other");
	expect(screen.getByRole("button", { name: /Get started.*0\/4/ })).toBeVisible();
	expect(screen.queryByRole("button", { name: "Resume guide" })).not.toBeInTheDocument();
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
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	fireEvent.click(await screen.findByText("Pause spotlight"));
	expect(track).toHaveBeenCalledWith("guide_paused", { props: { journey: "overlay", task: "overlay.name" } });
});

it("continues to an existing resource discovered after a task starts", async () => {
	mount();
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
	fireEvent.click(screen.getByRole("button", { name: "Create and name your overlay" }));
	fireEvent.click(screen.getByText("Load existing overlay"));
	await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/overlay/overlay-1"));
});

it("explains unavailable Theme Studio without starting a tour or paywall", () => {
	render(
		<UserTourProvider accountId='owner' appearanceAvailable={false}>
			<Harness />
		</UserTourProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
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
