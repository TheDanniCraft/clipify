import React from "react";
import { act, render } from "@testing-library/react";
import Spotlight from "@components/user-tour/spotlight";
const highlight = jest.fn();
const destroy = jest.fn();
let config: any;
jest.mock("driver.js", () => ({
	driver: (value: unknown) => {
		config = value;
		return { highlight, destroy };
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
	expect(highlight.mock.calls[0][0].popover.showButtons).toEqual(["close"]);
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
