import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import PlayerOverlay from "@/app/components/playerOverlay";

jest.mock("motion/react", () => ({
	AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
	motion: {
		div: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
			const attributes = { ...props };
			for (const key of ["initial", "animate", "exit", "transition"]) delete attributes[key];
			return <div {...attributes}>{children}</div>;
		},
	},
}));
afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
});

test("TDD-US4-DEC012 U293: Runner panels reserve identical bounds before fade-in and never reserve after fading out", () => {
	jest.useFakeTimers();
	const view = render(
		<PlayerOverlay reserveBeforeFade left='4%' top='8%' scale={2.5} fadeOutSeconds={6} className='p-2' style={{ borderWidth: "32px", borderStyle: "solid" }}>
			Reserved clip title
		</PlayerOverlay>,
	);
	const pending = view.container.querySelector('[data-player-overlay="pending-panel"]');
	expect(pending).toHaveAttribute("aria-hidden", "true");
	expect(pending).toHaveStyle({ opacity: "0", left: "4%", top: "8%", borderWidth: "32px", borderStyle: "solid" });
	expect((pending as HTMLElement).style.scale).toBe("2.5");
	expect(pending).toHaveClass("p-2");
	expect(view.container.querySelector('[data-player-overlay="panel"]')).not.toBeInTheDocument();
	act(() => jest.advanceTimersByTime(999));
	expect(view.container.querySelector('[data-player-overlay="pending-panel"]')).toBe(pending);
	act(() => jest.advanceTimersByTime(1));
	expect(view.container.querySelector('[data-player-overlay="pending-panel"]')).not.toBeInTheDocument();
	const visible = view.container.querySelector('[data-player-overlay="panel"]');
	expect(visible).toHaveStyle({ left: "4%", top: "8%", borderWidth: "32px", borderStyle: "solid" });
	expect((visible as HTMLElement).style.scale).toBe("2.5");
	act(() => jest.advanceTimersByTime(5000));
	expect(view.container.querySelectorAll("[data-player-overlay]")).toHaveLength(0);
});

test("TDD-US4-DEC012 U293 baseline: ordinary panels retain their existing delayed mount", () => {
	jest.useFakeTimers();
	const view = render(<PlayerOverlay fadeOutSeconds={6}>Ordinary title</PlayerOverlay>);
	expect(view.container.querySelectorAll("[data-player-overlay]")).toHaveLength(0);
	act(() => jest.advanceTimersByTime(1000));
	expect(view.container.querySelectorAll('[data-player-overlay="panel"]')).toHaveLength(1);
});

test("TDD-US4-DEC012 U293: an early fade-out timer cannot discard bounds for the still-pending first entry", () => {
	jest.useFakeTimers();
	const view = render(
		<PlayerOverlay reserveBeforeFade fadeOutSeconds={0.001}>
			Short fade title
		</PlayerOverlay>,
	);
	act(() => jest.advanceTimersByTime(999));
	expect(view.container.querySelectorAll('[data-player-overlay="pending-panel"]')).toHaveLength(1);
	expect(view.container.querySelectorAll('[data-player-overlay="panel"]')).toHaveLength(0);
	act(() => jest.advanceTimersByTime(1));
	expect(view.container.querySelectorAll('[data-player-overlay="pending-panel"]')).toHaveLength(0);
	expect(view.container.querySelectorAll('[data-player-overlay="panel"]')).toHaveLength(1);
});

test.each([
	{ name: "disabled", fadeOutSeconds: 0, remainsVisible: true },
	{ name: "default", fadeOutSeconds: undefined, remainsVisible: false },
])("TDD-US4-DEC012 U293 baseline: right-bottom reservations retain $name fade behavior", ({ fadeOutSeconds, remainsVisible }) => {
	jest.useFakeTimers();
	const view = render(
		<PlayerOverlay reserveBeforeFade right='4%' bottom='8%' fadeOutSeconds={fadeOutSeconds}>
			Right corner title
		</PlayerOverlay>,
	);
	const pending = view.container.querySelector('[data-player-overlay="pending-panel"]');
	expect(pending).toHaveStyle({ right: "4%", bottom: "8%", transformOrigin: "right bottom" });
	expect((pending as HTMLElement).style.scale).toBe("1");
	act(() => jest.advanceTimersByTime(1000));
	const visible = view.container.querySelector('[data-player-overlay="panel"]');
	expect(visible).toHaveStyle({ right: "4%", bottom: "8%", transformOrigin: "right bottom" });
	expect(view.container.querySelector('[data-player-overlay="pending-panel"]')).not.toBeInTheDocument();
	act(() => jest.advanceTimersByTime(6000));
	expect(view.container.querySelectorAll('[data-player-overlay="panel"]')).toHaveLength(remainsVisible ? 1 : 0);
	view.unmount();
	expect(jest.getTimerCount()).toBe(0);
});
