import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CompositionBox from "@components/creator/clipCompositionBox";
jest.mock("@heroui/react", () => ({
	Button: ({ children, onPress, isDisabled, variant: _variant, isIconOnly: _isIconOnly, size: _size, ...props }: any) => (
		<button {...props} disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	),
}));
it("supports precise keyboard movement without changing captured or output size", () => {
	const stage = createRef<HTMLDivElement>(),
		change = jest.fn(),
		rect = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 };
	render(
		<div ref={stage}>
			<CompositionBox rect={rect} label='Gameplay output' selected stage={stage} dimensions={{ width: 1000, height: 1000 }} onSelect={() => {}} onChange={change} />
		</div>,
	);
	fireEvent.keyDown(screen.getByRole("button", { name: "Gameplay output" }), { key: "ArrowRight" });
	expect(change).toHaveBeenCalledWith({ ...rect, x: 0.101 });
});
it("resizes from drag handles while preserving the supplied aspect ratio", () => {
	Object.defineProperty(window, "PointerEvent", {
		configurable: true,
		value: class extends MouseEvent {
			pointerId: number;
			constructor(type: string, init: any) {
				super(type, init);
				this.pointerId = init.pointerId ?? 1;
			}
		},
	});
	Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: jest.fn() });
	Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: jest.fn() });
	jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, toJSON: () => ({}) });
	const stage = createRef<HTMLDivElement>(),
		change = jest.fn();
	render(
		<div ref={stage}>
			<CompositionBox rect={{ x: 0.1, y: 0.1, w: 0.4, h: 0.2 }} label='Gameplay output' selected stage={stage} dimensions={{ width: 1000, height: 1000 }} ratio={(_event, rect) => rect.w / rect.h} onSelect={() => {}} onChange={change} />
		</div>,
	);
	const handle = screen.getByRole("button", { name: "Resize Gameplay output bottom right" });
	fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
	fireEvent.pointerMove(handle, { buttons: 1, clientX: 900, clientY: 500, pointerId: 1 });
	fireEvent.pointerUp(handle, { pointerId: 1 });
	expect(change).toHaveBeenCalledWith({ x: 0.1, y: 0.1, w: 0.8, h: 0.4 });
	jest.restoreAllMocks();
});

it("moves and snaps only the active primary pointer, supports cancellation and precise keyboard removal", () => {
	Object.defineProperty(window, "PointerEvent", {
		configurable: true,
		value: class extends MouseEvent {
			pointerId: number;
			constructor(type: string, init: any) {
				super(type, init);
				this.pointerId = init.pointerId ?? 1;
			}
		},
	});
	Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: jest.fn() });
	const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 1000 } as any);
	const stage = createRef<HTMLDivElement>(),
		change = jest.fn(),
		select = jest.fn(),
		guides = jest.fn(),
		remove = jest.fn();
	const rect = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 };
	const view = render(
		<div ref={stage}>
			<CompositionBox rect={rect} label='Layer' selected={false} stage={stage} dimensions={{ width: 1000, height: 1000 }} onSelect={select} onChange={change} snap onGuides={guides} onRemove={remove} />
		</div>,
	);
	const button = screen.getByRole("button", { name: "Layer" });
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 1, clientX: 0, clientY: 0 });
	fireEvent.pointerDown(button, { button: 2, pointerId: 1 });
	expect(select).not.toHaveBeenCalled();
	fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 2, clientX: 0, clientY: 0 });
	expect(change).not.toHaveBeenCalled();
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 1, clientX: 2, clientY: 2 });
	expect(change).toHaveBeenLastCalledWith({ ...rect, x: 0, y: 0 });
	expect(guides).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: 0 }));
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 1, clientX: 2, clientY: 2, altKey: true });
	expect(change.mock.calls.at(-1)[0].x).toBeCloseTo(0.002);
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 1, clientX: 2, clientY: 2, ctrlKey: true });
	expect(change.mock.calls.at(-1)[0].x).toBeCloseTo(0.002);
	fireEvent.pointerCancel(button);
	const count = change.mock.calls.length;
	fireEvent.pointerMove(button, { buttons: 1, pointerId: 1, clientX: 300, clientY: 300 });
	expect(change).toHaveBeenCalledTimes(count);
	for (const key of ["ArrowLeft", "ArrowUp", "ArrowDown"]) fireEvent.keyDown(button, { key, shiftKey: true });
	expect(change).toHaveBeenLastCalledWith({ ...rect, y: 0.11 });
	fireEvent.keyDown(button, { key: "Delete" });
	fireEvent.keyDown(button, { key: "Backspace" });
	fireEvent.keyDown(button, { key: "x" });
	expect(remove).toHaveBeenCalledTimes(2);
	fireEvent.click(button);
	expect(select).toHaveBeenCalled();
	view.rerender(<CompositionBox rect={rect} label='Layer' selected stage={{ current: null }} dimensions={{ width: 1000, height: 1000 }} onSelect={select} onChange={change} />);
	fireEvent.pointerDown(screen.getByRole("button", { name: "Resize Layer top left" }), { button: 0, pointerId: 1 });
	fireEvent.pointerMove(screen.getByRole("button", { name: "Resize Layer top left" }), { buttons: 1, pointerId: 1, clientX: 30, clientY: 30 });
	fireEvent.lostPointerCapture(screen.getByRole("button", { name: "Layer" }));
	bounds.mockRestore();
});

it("stops movement when the primary button was released outside the control", () => {
	const stage = createRef<HTMLDivElement>(),
		change = jest.fn();
	jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 1000 } as DOMRect);
	render(
		<div ref={stage}>
			<CompositionBox rect={{ x: 0.1, y: 0.1, w: 0.4, h: 0.2 }} label='Release' selected stage={stage} dimensions={{ width: 1000, height: 1000 }} onSelect={() => {}} onChange={change} />
		</div>,
	);
	const box = screen.getByRole("button", { name: "Release" });
	fireEvent.pointerDown(box, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
	fireEvent.pointerMove(window, { buttons: 0, pointerId: 1, clientX: 200, clientY: 200 });
	fireEvent.pointerMove(window, { buttons: 1, pointerId: 1, clientX: 300, clientY: 300 });
	expect(change).not.toHaveBeenCalled();
	fireEvent.pointerDown(box, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
	fireEvent.blur(window);
	fireEvent.pointerMove(window, { buttons: 1, pointerId: 1, clientX: 300, clientY: 300 });
	expect(change).not.toHaveBeenCalled();
	jest.restoreAllMocks();
});

it("snaps a resized edge to a neighboring layer and ignores another pointer's release", () => {
	const stage = createRef<HTMLDivElement>(),
		change = jest.fn();
	jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 1000 } as DOMRect);
	render(
		<div ref={stage}>
			<CompositionBox rect={{ x: 0.1, y: 0.1, w: 0.4, h: 0.2 }} label='Snap' selected stage={stage} dimensions={{ width: 1000, height: 1000 }} onSelect={() => {}} onChange={change} snap targets={[{ x: 0.75, y: 0.5, w: 0.1, h: 0.1 }]} />
		</div>,
	);
	const handle = screen.getByRole("button", { name: "Resize Snap right" });
	fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500, clientY: 200 });
	fireEvent.pointerUp(window, { pointerId: 2 });
	fireEvent.pointerMove(window, { buttons: 1, pointerId: 1, clientX: 747, clientY: 200 });
	expect(change).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1, w: 0.65, h: 0.2 });
	fireEvent.pointerMove(window, { buttons: 1, pointerId: 1, clientX: 747, clientY: 200, ctrlKey: true });
	expect(change.mock.calls.at(-1)[0].w).toBeCloseTo(0.647);
	fireEvent.pointerUp(window, { pointerId: 1 });
	const count = change.mock.calls.length;
	fireEvent.pointerMove(window, { buttons: 1, pointerId: 1, clientX: 900, clientY: 200 });
	expect(change).toHaveBeenCalledTimes(count);
	jest.restoreAllMocks();
});

it("keeps a widget's accessible name without drawing a label over its content", () => {
	const stage = createRef<HTMLDivElement>();
	render(
		<div ref={stage}>
			<CompositionBox rect={{ x: 0.1, y: 0.1, w: 0.4, h: 0.1 }} label='Channel badge output' selected showLabel={false} stage={stage} dimensions={{ width: 720, height: 1280 }} onSelect={() => {}} onChange={() => {}} />
		</div>,
	);
	expect(screen.getByRole("button", { name: "Channel badge output" })).toBeInTheDocument();
	expect(screen.queryByText("Channel badge output")).not.toBeInTheDocument();
});
