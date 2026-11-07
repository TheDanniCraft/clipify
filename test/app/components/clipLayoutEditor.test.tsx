import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import Editor from "@components/creator/clipLayoutEditor";
import { defaultClipLayout } from "@lib/clipLayout";
const preview = jest.fn(),
	load = jest.fn(),
	save = jest.fn(),
	notify = jest.fn(),
	push = jest.fn(),
	accept = jest.fn(),
	reject = jest.fn();
let active = false;
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: () => ({ active, accept, reject }) }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...args: unknown[]) => preview(...args) }));
jest.mock("@actions/clipLayouts", () => ({ loadClipLayout: (...args: unknown[]) => load(...args), saveClipLayout: (...args: unknown[]) => save(...args) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@components/dashboardEditorLayout", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
jest.mock("@components/controlledModal", () => ({ __esModule: true, default: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <div role='dialog'>{children}</div> : null) }));
jest.mock("@components/creator/clipExport", () => ({ __esModule: true, default: ({ layout, format }: { layout: unknown; format: string }) => <output aria-label='Export layout'>{JSON.stringify({ layout, format })}</output> }));
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../__mocks__/heroui-react.cjs");
	const React = jest.requireActual("react");
	const Part = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const Slider = Object.assign(
		({ children, value, minValue, maxValue, onChange }: { children: React.ReactNode; value: number; minValue: number; maxValue: number; onChange: (v: number) => void }) => {
			const label = (React.Children.toArray(children)[0] as React.ReactElement<{ children: string }>).props.children;
			return (
				<div>
					{children}
					<input type='range' aria-label={label} value={value} min={minValue} max={maxValue} onChange={(e) => onChange(Number(e.target.value))} />
				</div>
			);
		},
		{ Output: Part, Track: Part, Fill: () => null, Thumb: () => null },
	);
	const Button = ({ children, onPress, isDisabled, onPointerDown, onKeyDown, ...rest }: { children: React.ReactNode; onPress: () => void; isDisabled: boolean; onPointerDown: React.PointerEventHandler; onKeyDown: React.KeyboardEventHandler; [key: string]: unknown }) => (
		<button aria-label={rest["aria-label"] as string} disabled={isDisabled} onClick={onPress} onPointerDown={onPointerDown} onKeyDown={onKeyDown}>
			{children}
		</button>
	);
	const Checkbox = Object.assign(
		({ children, isSelected, onChange }: { children: React.ReactNode; isSelected: boolean; onChange: (v: boolean) => void }) => (
			<label>
				<input type='checkbox' checked={isSelected} onChange={(e) => onChange(e.target.checked)} />
				{children}
			</label>
		),
		{ Content: Part, Control: Part, Indicator: () => null },
	);
	const ToggleButton = ({ children, onPress, isSelected, isDisabled }: { children: React.ReactNode; onPress?: () => void; isSelected: boolean; isDisabled?: boolean }) => (
		<button role='radio' aria-checked={isSelected} disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	);
	const ToggleButtonGroup = ({ children, onSelectionChange, selectedKeys }: { children: React.ReactNode; selectedKeys: Set<string>; onSelectionChange: (keys: Set<string>) => void }) => <div>{React.Children.map(children, (child: React.ReactElement<{ id: string }>) => React.cloneElement(child, { isSelected: selectedKeys.has(child.props.id), onPress: () => onSelectionChange(new Set([child.props.id])) }))}</div>;
	return { ...base, Label: Part, Modal: base.Modal, Slider, Button, Checkbox, ToggleButton, ToggleButtonGroup };
});
const clip = { id: "A", title: "Winner", broadcasterName: "Channel", clipCreatorName: "Viewer" };
const data = { ok: true, clip } as never;
let frames: FrameRequestCallback[] = [];
const ctx = { fillRect: jest.fn(), drawImage: jest.fn(), measureText: jest.fn(() => ({ width: 100 })), fillText: jest.fn() };
beforeEach(() => {
	jest.clearAllMocks();
	active = false;
	frames = [];
	load.mockResolvedValue({ ok: true, layout: null });
	save.mockResolvedValue({ ok: true });
	preview.mockResolvedValue({ playbackUrl: "https://media.invalid/clip.mp4" });
	jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
		frames.push(cb);
		return frames.length;
	});
	jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
	jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
	Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());
async function ready() {
	await screen.findByRole("button", { name: "Play clip" });
	await waitFor(() => expect(load).toHaveBeenCalled());
	await waitFor(() => expect(document.querySelector("video")).not.toBeNull());
	fireEvent.loadedData(document.querySelector("video")!);
}
function state() {
	return JSON.parse(screen.getByLabelText("Export layout").textContent!);
}
it("loads a saved channel layout, allows full/stacked framing and saves the current edits", async () => {
	load.mockResolvedValue({ ok: true, layout: { ...defaultClipLayout, mode: "full" } });
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	await waitFor(() => expect(state().layout.mode).toBe("full"));
	fireEvent.click(screen.getByRole("radio", { name: "Stacked" }));
	fireEvent.change(screen.getByRole("slider", { name: "Camera height (%)" }), { target: { value: 40 } });
	fireEvent.change(screen.getByRole("slider", { name: "Crop width" }), { target: { value: 50 } });
	fireEvent.change(screen.getByRole("slider", { name: "Horizontal position" }), { target: { value: 90 } });
	expect(state().layout.gameplay).toMatchObject({ w: 0.5, x: 0.5 });
	fireEvent.click(screen.getByRole("radio", { name: "Camera" }));
	fireEvent.change(screen.getByRole("slider", { name: "Crop height" }), { target: { value: 20 } });
	fireEvent.click(screen.getByRole("button", { name: "Save channel layout" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("owner", expect.objectContaining({ cameraShare: 0.4 })));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save channel layout" })).toBeDisabled());
});
it("edits metadata layers and resets without changing the original clip", async () => {
	render(<Editor creatorId='owner' ids={["A", "B"]} data={data} />);
	await ready();
	expect(state().format).toBe("zip");
	for (const name of ["Channel name", "Clip title", "Clipped by"]) fireEvent.click(screen.getByText(name, { exact: true }).closest("label")!.querySelector("input")!);
	expect(state().layout.textLayers).toHaveLength(3);
	fireEvent.change(screen.getAllByRole("slider", { name: "Text size" })[0], { target: { value: 30 } });
	fireEvent.change(screen.getAllByRole("slider", { name: "Left (%)" })[0], { target: { value: 15 } });
	fireEvent.change(screen.getAllByRole("slider", { name: "Top (%)" })[0], { target: { value: 25 } });
	expect(state().layout.textLayers[0]).toMatchObject({ size: 30, x: 15, y: 25 });
	fireEvent.click(screen.getByText("Clip title", { exact: true }).closest("label")!.querySelector("input")!);
	expect(state().layout.textLayers).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
	expect(state().layout).toEqual(defaultClipLayout);
	expect(clip.title).toBe("Winner");
});
it("keeps edits after save failures and offers source retry", async () => {
	preview.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("network")).mockResolvedValue({ playbackUrl: "https://media.invalid/retry.mp4" });
	load.mockResolvedValue({ ok: false });
	save.mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error("network"));
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
	fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
	await ready();
	fireEvent.click(screen.getByRole("radio", { name: "Full" }));
	for (let i = 0; i < 2; i++) {
		fireEvent.click(screen.getByRole("button", { name: "Save channel layout" }));
		await waitFor(() => expect(save).toHaveBeenCalledTimes(i + 1));
		await waitFor(() => expect(screen.getByRole("button", { name: "Save channel layout" })).toBeEnabled());
	}
	expect(state().layout.mode).toBe("full");
	fireEvent.error(document.querySelector("video")!);
	expect(await screen.findByRole("button", { name: "Retry preview" })).toBeVisible();
});
it("supports keyboard crop movement and synchronized playback/preview frames", async () => {
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	const video = document.querySelector("video")!;
	Object.defineProperties(video, { readyState: { value: 4, configurable: true }, videoWidth: { value: 1920, configurable: true }, videoHeight: { value: 1080, configurable: true }, duration: { value: 12, configurable: true }, paused: { value: true, configurable: true } });
	const play = jest.spyOn(video, "play").mockResolvedValue(),
		pause = jest.spyOn(video, "pause").mockImplementation(() => {});
	fireEvent.loadedMetadata(video);
	fireEvent.change(screen.getByRole("slider", { name: "Preview position" }), { target: { value: 3 } });
	expect(video.currentTime).toBe(3);
	fireEvent.timeUpdate(video);
	fireEvent.click(screen.getByRole("button", { name: "Play clip" }));
	expect(play).toHaveBeenCalled();
	fireEvent.play(video);
	Object.defineProperty(video, "paused", { value: false, configurable: true });
	fireEvent.click(screen.getByRole("button", { name: "Pause clip" }));
	expect(pause).toHaveBeenCalled();
	fireEvent.pause(video);
	fireEvent.change(screen.getByRole("slider", { name: "Crop width" }), { target: { value: 50 } });
	const crop = screen.getByRole("button", { name: "Move gameplay crop" });
	fireEvent.keyDown(crop, { key: "ArrowRight" });
	fireEvent.keyDown(crop, { key: "ArrowDown", shiftKey: true });
	fireEvent.keyDown(crop, { key: "ArrowLeft" });
	fireEvent.keyDown(crop, { key: "ArrowUp" });
	fireEvent.keyDown(crop, { key: "Enter" });
	expect(state().layout.gameplay.x).toBe(0);
	fireEvent.click(screen.getByText("Clip title", { exact: true }).closest("label")!.querySelector("input")!);
	act(() => {
		frames.shift()?.(0);
	});
	expect(ctx.drawImage).toHaveBeenCalledTimes(2);
	expect(ctx.fillText).toHaveBeenCalledWith("Winner", expect.any(Number), expect.any(Number), 704);
	fireEvent.click(screen.getByRole("radio", { name: "Full" }));
	act(() => {
		frames.shift()?.(0);
	});
	expect(ctx.drawImage).toHaveBeenCalledTimes(3);
});
it("guards navigation and handles unavailable metadata without losing context", async () => {
	active = true;
	const view = render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	fireEvent.click(screen.getByRole("button", { name: "Back to clip details" }));
	expect(push).toHaveBeenCalledWith("/dashboard/clips/A");
	fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
	expect(reject).toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Leave editor" }));
	expect(accept).toHaveBeenCalled();
	view.unmount();
	render(<Editor creatorId='owner' ids={["A"]} data={{ ok: false, code: "NOT_FOUND" } as never} />);
	expect(screen.getByRole("link", { name: "Return to clip inventory" })).toHaveAttribute("href", "/dashboard/clips");
});

it("moves and resizes source crops with a pointer, keeping them inside the source", async () => {
	const pointer = window.PointerEvent;
	window.PointerEvent = MouseEvent as typeof PointerEvent;
	const view = render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	const stage = view.container.querySelector("[data-source-stage]")!;
	jest.spyOn(stage, "getBoundingClientRect").mockReturnValue({
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		left: 0,
		top: 0,
		right: 100,
		bottom: 100,
		toJSON() {
			return {};
		},
	});
	const crop = screen.getByRole("button", { name: "Move camera crop" });
	fireEvent.pointerDown(crop, { button: 2, clientX: 80, clientY: 0 });
	fireEvent.pointerDown(crop, { button: 0, clientX: 80, clientY: 0 });
	fireEvent.pointerMove(crop, { clientX: 10, clientY: 20 });
	fireEvent.pointerUp(crop);
	expect(state().layout.camera.x).toBeCloseTo(0.05);
	expect(state().layout.camera.y).toBe(0.2);
	const handle = screen.getByRole("button", { name: "Resize camera crop" });
	fireEvent.pointerDown(handle, { button: 0, clientX: 10, clientY: 20 });
	fireEvent.pointerMove(handle, { clientX: 110, clientY: 120 });
	fireEvent.pointerCancel(handle);
	expect(state().layout.camera.w).toBeCloseTo(0.95);
	expect(state().layout.camera.h).toBe(0.8);
	window.PointerEvent = pointer;
});
it("does not mark newer edits saved when an older save completes", async () => {
	let finish: (r: unknown) => void = () => {};
	save.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			}),
	);
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	fireEvent.click(screen.getByRole("radio", { name: "Full" }));
	fireEvent.click(screen.getByRole("button", { name: "Save channel layout" }));
	fireEvent.click(screen.getByRole("radio", { name: "Stacked" }));
	await act(async () => finish({ ok: true }));
	expect(screen.getByRole("button", { name: "Save channel layout" })).toBeEnabled();
});

it("returns crop controls to gameplay when switching from camera to Full mode", async () => {
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	fireEvent.click(screen.getByRole("radio", { name: "Camera" }));
	fireEvent.click(screen.getByRole("radio", { name: "Full" }));
	expect(screen.getByRole("slider", { name: "Crop width" })).toHaveValue("100");
});

it("keeps exports disabled until the saved channel preset has loaded", async () => {
	let finish: (r: unknown) => void = () => {};
	load.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			}),
	);
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	expect(screen.getByLabelText("Export layout").closest("fieldset")).toBeDisabled();
	await act(async () => finish({ ok: true, layout: { ...defaultClipLayout, mode: "full" } }));
	await ready();
	expect(screen.getByLabelText("Export layout").closest("fieldset")).not.toBeDisabled();
	expect(state().layout.mode).toBe("full");
});
it("recovers from preset, playback and canvas failures without discarding the layout", async () => {
	load.mockRejectedValue(new Error("offline"));
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await ready();
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved layout could not be loaded" })));
	const v = document.querySelector("video")!;
	Object.defineProperties(v, { readyState: { value: 4 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
	jest.spyOn(v, "play").mockRejectedValue(new Error("blocked"));
	fireEvent.click(screen.getByRole("button", { name: "Play clip" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Playback could not start" })));
	ctx.drawImage.mockImplementationOnce(() => {
		throw new Error("canvas unavailable");
	});
	act(() => {
		frames.shift()?.(0);
	});
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Portrait preview unavailable" }));
	expect(state().layout).toEqual(defaultClipLayout);
	expect(screen.getByLabelText("Export layout").closest("fieldset")).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Retry portrait preview" }));
	await ready();
	expect(preview).toHaveBeenLastCalledWith({ creatorId: "owner", clipId: "A", refresh: true });
	expect(screen.getByLabelText("Export layout").closest("fieldset")).not.toBeDisabled();
});
it("does not offer an unseen portrait export while the source is missing or decoding", async () => {
	preview.mockResolvedValueOnce(null).mockResolvedValue({ playbackUrl: "https://media.invalid/retry.mp4" });
	render(<Editor creatorId='owner' ids={["A"]} data={data} />);
	await screen.findByRole("button", { name: "Retry preview" });
	expect(screen.getByLabelText("Export layout").closest("fieldset")).toBeDisabled();
	expect(screen.getByText("Load the source clip to preview your portrait.")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(document.querySelector("video")).not.toBeNull());
	expect(screen.getByLabelText("Export layout").closest("fieldset")).toBeDisabled();
	fireEvent.loadedData(document.querySelector("video")!);
	expect(screen.getByLabelText("Export layout").closest("fieldset")).not.toBeDisabled();
	fireEvent.error(document.querySelector("video")!);
	expect(screen.getByLabelText("Export layout").closest("fieldset")).toBeDisabled();
	expect(state().layout).toEqual(defaultClipLayout);
});
