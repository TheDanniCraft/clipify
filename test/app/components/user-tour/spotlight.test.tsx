import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Spotlight from "@components/user-tour/spotlight";
const highlight = jest.fn();
const destroy = jest.fn();
const refresh = jest.fn();
let config: any;
jest.mock("driver.js", () => ({
	driver: (value: unknown) => {
		config = value;
		return { highlight, destroy, refresh };
	},
}));
beforeEach(() => {
	jest.clearAllMocks();
	window.matchMedia = jest.fn().mockReturnValue({ matches: true });
});
const step = { target: "control", title: "Choose clips", description: "Choose a source", next: true };
it("highlights the real control with interaction enabled and reduced motion respected", () => {
	const pause = jest.fn();
	const next = jest.fn();
	const view = render(
		<>
			<button data-tour='control'>Real control</button>
			<Spotlight step={step} onPause={pause} onMissing={jest.fn()} onNext={next} />
		</>,
	);
	expect(config).toMatchObject({ disableActiveInteraction: false, animate: false });
	expect(highlight).toHaveBeenCalledWith(expect.objectContaining({ element: document.querySelector('[data-tour="control"]'), popover: expect.objectContaining({ onNextClick: next }) }));
	act(() => config.onDestroyed());
	expect(pause).toHaveBeenCalledTimes(1);
	view.unmount();
	expect(destroy).toHaveBeenCalled();
});
it("waits for delayed targets and pauses if none appears", () => {
	jest.useFakeTimers();
	const missing = jest.fn();
	const view = render(<Spotlight step={step} onPause={jest.fn()} onMissing={missing} onNext={jest.fn()} />);
	expect(highlight).not.toHaveBeenCalled();
	act(() => jest.advanceTimersByTime(8000));
	expect(missing).toHaveBeenCalledTimes(1);
	view.unmount();
	jest.useRealTimers();
});
it("action steps have no Continue escape hatch and setup confirmation is explicit", () => {
	const confirm = jest.fn();
	const view = render(
		<>
			<button data-tour='control'>Copy</button>
			<Spotlight step={{ ...step, next: false }} onPause={jest.fn()} onMissing={jest.fn()} onNext={jest.fn()} onConfirm={confirm} />
		</>,
	);
	expect(highlight.mock.calls[0][0].popover.onNextClick).toBe(confirm);
	view.unmount();
	highlight.mockClear();
	render(
		<>
			<button data-tour='control'>Save</button>
			<Spotlight step={{ ...step, next: false }} onPause={jest.fn()} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	expect(highlight.mock.calls[0][0].popover.showButtons).toEqual([]);
});

it("pauses on Escape independently of native popover dismissal", () => {
	const pause = jest.fn();
	render(
		<>
			<button data-tour='control'>Real control</button>
			<Spotlight step={step} onPause={pause} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
	expect(pause).toHaveBeenCalledTimes(1);
});

it("finds a target whose anchor appears after asynchronous access loading", async () => {
	const pause = jest.fn(),
		missing = jest.fn(),
		next = jest.fn();
	const view = render(
		<>
			<button>Delayed control</button>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	expect(highlight).not.toHaveBeenCalled();
	view.rerender(
		<>
			<button data-tour='control'>Delayed control</button>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(highlight).toHaveBeenCalled();
});

it("pauses for an application dialog even when aria-modal is omitted", async () => {
	const pause = jest.fn(),
		missing = jest.fn(),
		next = jest.fn();
	const view = render(
		<>
			<button data-tour='control'>Open clips</button>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	view.rerender(
		<>
			<button data-tour='control'>Open clips</button>
			<div role='dialog' data-slot='modal-dialog'>
				Choose clips
			</div>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(pause).toHaveBeenCalled();
});

it("keeps a portalled select open without pausing the guide", async () => {
	const pause = jest.fn(),
		missing = jest.fn(),
		next = jest.fn();
	const view = render(
		<>
			<button data-tour='control'>Choose source</button>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	view.rerender(
		<>
			<button data-tour='control'>Choose source</button>
			<div role='dialog' data-slot='select-popover'>
				<div role='listbox'>Options</div>
			</div>
			<Spotlight step={step} onPause={pause} onMissing={missing} onNext={next} />
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(pause).not.toHaveBeenCalled();
});
it("keeps an access-locked filter region read-only during a spotlight", () => {
	render(
		<>
			<div data-tour='control' data-tour-readonly='true'>
				Locked filters
			</div>
			<Spotlight step={step} onPause={jest.fn()} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	expect(highlight).toHaveBeenCalledWith(expect.objectContaining({ disableActiveInteraction: true }));
});
it("hands focus to an expected clip dialog and resumes the same pointer after it closes", async () => {
	const pause = jest.fn();
	const pointer = <Spotlight step={{ ...step, allowDialog: true }} onPause={pause} onMissing={jest.fn()} onNext={jest.fn()} />;
	const view = render(
		<>
			<button data-tour='control'>Add clips</button>
			{pointer}
		</>,
	);
	view.rerender(
		<>
			<button data-tour='control'>Add clips</button>
			<div data-slot='modal-dialog' role='dialog'>
				Choose clips
			</div>
			{pointer}
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(destroy).toHaveBeenCalled();
	expect(pause).not.toHaveBeenCalled();
	view.rerender(
		<>
			<button data-tour='control'>Add clips</button>
			{pointer}
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(highlight).toHaveBeenCalledTimes(2);
});
it("advances a tab step only when the real tab becomes selected", async () => {
	const next = jest.fn();
	const view = render(
		<>
			<button role='tab' aria-selected='false' data-tour='control'>
				Playlists
			</button>
			<Spotlight step={{ ...step, action: true }} onPause={jest.fn()} onMissing={jest.fn()} onNext={next} />
		</>,
	);
	expect(next).not.toHaveBeenCalled();
	view.rerender(
		<>
			<button role='tab' aria-selected='true' data-tour='control'>
				Playlists
			</button>
			<Spotlight step={{ ...step, action: true }} onPause={jest.fn()} onMissing={jest.fn()} onNext={next} />
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(next).toHaveBeenCalledTimes(1);
});
it("preserves the application's expanded state when Driver annotates a control", () => {
	highlight.mockImplementationOnce(({ element }) => {
		element.setAttribute("aria-expanded", "true");
		element.setAttribute("aria-haspopup", "dialog");
	});
	render(
		<>
			<button data-tour='control' aria-expanded='false' aria-haspopup='menu'>
				Open menu
			</button>
			<Spotlight step={step} onPause={jest.fn()} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	expect(document.querySelector('[data-tour="control"]')).toHaveAttribute("aria-expanded", "false");
	expect(document.querySelector('[data-tour="control"]')).toHaveAttribute("aria-haspopup", "menu");
});
it("advances after a real menu reveals its next control", async () => {
	const next = jest.fn();
	const pointer = <Spotlight step={{ ...step, action: true, reveals: "menu-tools" }} onPause={jest.fn()} onMissing={jest.fn()} onNext={next} />;
	const view = render(
		<>
			<button data-tour='control'>Open menu</button>
			{pointer}
		</>,
	);
	expect(next).not.toHaveBeenCalled();
	view.rerender(
		<>
			<button data-tour='control'>Open menu</button>
			<div role='menuitem' data-tour='menu-tools'>
				Tools
			</div>
			{pointer}
		</>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(next).toHaveBeenCalledTimes(1);
});
it("lets support controls open their normal UI by pausing on the user's click", () => {
	const pause = jest.fn();
	render(
		<>
			<button data-tour='control'>Report a problem</button>
			<Spotlight step={{ ...step, pauseOnInteract: true }} onPause={pause} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	act(() => document.querySelector('[data-tour="control"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
	expect(pause).toHaveBeenCalledTimes(1);
});
it("renders the guide actions through HeroUI instead of Driver buttons", () => {
	const previous = jest.fn(),
		next = jest.fn(),
		pause = jest.fn();
	const view = render(
		<>
			<button data-tour='control'>Save</button>
			<Spotlight step={step} onPause={pause} onMissing={jest.fn()} onNext={next} onPrevious={previous} />
		</>,
	);
	const wrapper = document.createElement("div"),
		closeButton = document.createElement("button");
	closeButton.style.display = "none";
	wrapper.appendChild(closeButton);
	document.body.appendChild(wrapper);
	const popover = highlight.mock.calls[0][0].popover;
	expect(popover.showButtons).toEqual([]);
	act(() => popover.onPopoverRender({ wrapper, closeButton }));
	expect(screen.getByRole("button", { name: "Back" })).not.toHaveClass("driver-popover-prev-btn");
	fireEvent.click(screen.getByRole("button", { name: "Back" }));
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	fireEvent.click(screen.getByRole("button", { name: "Pause guide" }));
	expect(previous).toHaveBeenCalledTimes(1);
	expect(next).toHaveBeenCalledTimes(1);
	expect(pause).toHaveBeenCalledTimes(1);
	view.unmount();
	wrapper.remove();
});

it("refreshes portal geometry after Driver finishes its highlight animation", () => {
	render(
		<>
			<button data-tour='control'>Save</button>
			<Spotlight step={step} onPause={jest.fn()} onMissing={jest.fn()} onNext={jest.fn()} />
		</>,
	);
	act(() => config.onHighlighted());
	expect(refresh).toHaveBeenCalledTimes(1);
});
it("keeps guided picker controls inside the owning modal focus scope", () => {
	const pause = jest.fn(),
		next = jest.fn();
	const view = render(
		<>
			<div role='dialog' data-slot='modal-dialog'>
				<input data-tour='control' />
			</div>
			<Spotlight step={{ ...step, inDialog: true }} onPause={pause} onMissing={jest.fn()} onNext={next} />
		</>,
	);
	const modal = screen.getByRole("dialog");
	expect(pause).not.toHaveBeenCalled();
	expect(modal).toHaveAttribute("data-tour-guided-dialog", "true");
	const wrapper = document.createElement("div"),
		closeButton = document.createElement("button");
	closeButton.style.display = "none";
	wrapper.appendChild(closeButton);
	wrapper.setAttribute("inert", "");
	wrapper.setAttribute("aria-hidden", "true");
	document.body.appendChild(wrapper);
	act(() => highlight.mock.calls[0][0].popover.onPopoverRender({ wrapper, closeButton }));
	expect(modal).toContainElement(wrapper);
	expect(wrapper).not.toHaveAttribute("inert");
	expect(wrapper).not.toHaveAttribute("aria-hidden");
	const windowTab = jest.fn();
	window.addEventListener("keydown", windowTab);
	const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
	act(() => modal.querySelector("input")!.dispatchEvent(tab));
	expect(tab.defaultPrevented).toBe(false);
	expect(windowTab).not.toHaveBeenCalled();
	window.removeEventListener("keydown", windowTab);
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	expect(next).toHaveBeenCalledTimes(1);
	view.unmount();
	expect(modal).not.toHaveAttribute("data-tour-guided-dialog");
});
