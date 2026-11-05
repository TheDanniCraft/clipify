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
	fireEvent.pointerMove(handle, { clientX: 900, clientY: 500, pointerId: 1 });
	fireEvent.pointerUp(handle, { pointerId: 1 });
	expect(change).toHaveBeenCalledWith({ x: 0.1, y: 0.1, w: 0.8, h: 0.4 });
	jest.restoreAllMocks();
});
