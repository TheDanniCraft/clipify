import { act, render, screen } from "@testing-library/react";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";

test("TDD-US4-FR019 U19: empty content displays the saved Pro standby and preserves its content node", async () => {
	const view = render(
		<RunnerGeneratedPresentation attributionRequired={false} runnerPro executionGeneration='empty-playlist' standbyBackgroundColor='#16324f' standbyMessage='Saved empty-playlist scene' standbyBackgroundImageUrl='/runner/presentation/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002'>
			<span data-runner-content-phase='empty' data-testid='empty-playlist-player' />
		</RunnerGeneratedPresentation>,
	);
	const content = screen.getByTestId("empty-playlist-player");
	await act(async () => {
		await Promise.resolve();
	});
	expect(view.container.querySelector("[data-runner-standby]")).toHaveStyle({ backgroundColor: "#16324f" });
	expect(screen.getByText("Saved empty-playlist scene", { exact: true })).toBeVisible();
	expect(screen.getByRole("img", { name: "Standby background" })).toHaveAttribute("src", "/runner/presentation/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002");
	expect(screen.getByTestId("empty-playlist-player")).toBe(content);
	view.unmount();
});

type Box = { left: number; top: number; width: number; height: number };

function layoutBoundary(initial: Box) {
	let panelBox = initial;
	const originalResize = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
	const observers: { targets: Set<Element>; notify: () => void }[] = [];
	class LayoutResizeObserver {
		targets = new Set<Element>();
		constructor(callback: ResizeObserverCallback) {
			observers.push({ targets: this.targets, notify: () => callback([], this as unknown as ResizeObserver) });
		}
		observe(target: Element) {
			this.targets.add(target);
		}
		unobserve(target: Element) {
			this.targets.delete(target);
		}
		disconnect() {
			this.targets.clear();
		}
	}
	Reflect.set(globalThis, "ResizeObserver", LayoutResizeObserver);
	const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
		if (this.hasAttribute("data-runner-presentation-generation")) return new DOMRect(0, 0, 1920, 1080);
		if (this.hasAttribute("data-runner-attribution")) return new DOMRect(0, 0, 680, 140);
		if (this.hasAttribute("data-player-overlay")) return new DOMRect(panelBox.left, panelBox.top, panelBox.width, panelBox.height);
		return new DOMRect(0, 0, 0, 0);
	});
	return {
		resizePanel(panel: Element, box: Box) {
			panelBox = box;
			for (const observer of observers) if (observer.targets.has(panel)) observer.notify();
		},
		restore() {
			bounds.mockRestore();
			if (originalResize) Object.defineProperty(globalThis, "ResizeObserver", originalResize);
			else Reflect.deleteProperty(globalThis, "ResizeObserver");
		},
	};
}

async function flushLayout() {
	await act(async () => {
		await Promise.resolve();
		await jest.advanceTimersByTimeAsync(40);
	});
}

test("TDD-US4-DEC012: a known collision remains invalid when its panels leave for standby", async () => {
	jest.useFakeTimers();
	const boundary = layoutBoundary({ left: 0, top: 0, width: 1920, height: 1080 });
	const view = render(
		<RunnerGeneratedPresentation attributionRequired executionGeneration='same-execution'>
			<div data-player-overlay='panel' style={{ opacity: 1 }} />
		</RunnerGeneratedPresentation>,
	);
	try {
		await flushLayout();
		expect(screen.getByRole("alert")).toHaveTextContent("Adjust your overlay layout");
		view.rerender(
			<RunnerGeneratedPresentation attributionRequired executionGeneration='same-execution'>
				{null}
			</RunnerGeneratedPresentation>,
		);
		await flushLayout();
		expect(screen.getByRole("alert")).toHaveTextContent("Adjust your overlay layout");
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "blocked");
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-DEC012: a new execution cannot reuse the previous generation's measured readiness", async () => {
	jest.useFakeTimers();
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const view = render(
		<RunnerGeneratedPresentation attributionRequired executionGeneration='first' watermarkCorner='top_left'>
			<div data-player-overlay='panel' style={{ opacity: 1 }} />
		</RunnerGeneratedPresentation>,
	);
	try {
		await flushLayout();
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toHaveStyle({ left: "24px" });
		boundary.resizePanel(view.container.querySelector('[data-player-overlay="panel"]')!, { left: 0, top: 0, width: 700, height: 180 });
		view.rerender(
			<RunnerGeneratedPresentation attributionRequired executionGeneration='second' watermarkCorner='top_left'>
				<div data-player-overlay='panel' style={{ opacity: 1 }} />
			</RunnerGeneratedPresentation>,
		);
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-presentation-generation", "second");
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "pending");
		await flushLayout();
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toHaveStyle({ left: "1216px" });
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-DEC012: a growing visible player panel triggers fresh clearance without a style mutation", async () => {
	jest.useFakeTimers();
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const view = render(
		<RunnerGeneratedPresentation attributionRequired executionGeneration='panel-resize' watermarkCorner='top_left'>
			<div data-player-overlay='panel' style={{ opacity: 1 }} />
		</RunnerGeneratedPresentation>,
	);
	try {
		await flushLayout();
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toHaveStyle({ left: "24px" });
		boundary.resizePanel(view.container.querySelector('[data-player-overlay="panel"]')!, { left: 0, top: 0, width: 700, height: 180 });
		await flushLayout();
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toHaveStyle({ left: "1216px" });
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-EXP001 U289: paid expiry restores branding without replacing the child and cleans up a renewed deadline", async () => {
	jest.useFakeTimers({ now: 1000000 });
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const content = <video data-testid='continuing-generated-clip' />;
	const view = render(
		<RunnerGeneratedPresentation attributionRequired={false} executionGeneration='continuing-execution' knownPaidUntil={new Date(1001000).toISOString()}>
			{content}
		</RunnerGeneratedPresentation>,
	);
	const originalChild = screen.getByTestId("continuing-generated-clip");
	try {
		expect(screen.queryByLabelText("Livestream powered by Clipify.us")).not.toBeInTheDocument();
		await act(async () => {
			await jest.advanceTimersByTimeAsync(999);
		});
		expect(screen.queryByLabelText("Livestream powered by Clipify.us")).not.toBeInTheDocument();
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1);
		});
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toBeInTheDocument();
		await flushLayout();
		expect(screen.getByTestId("continuing-generated-clip")).toBe(originalChild);
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-presentation-generation", "continuing-execution");
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
		view.rerender(
			<RunnerGeneratedPresentation attributionRequired={false} executionGeneration='continuing-execution' knownPaidUntil={new Date(Date.now() + 5000).toISOString()}>
				{content}
			</RunnerGeneratedPresentation>,
		);
		expect(screen.queryByLabelText("Livestream powered by Clipify.us")).not.toBeInTheDocument();
		expect(screen.getByTestId("continuing-generated-clip")).toBe(originalChild);
		expect(jest.getTimerCount()).toBeGreaterThan(0);
		view.unmount();
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-DEC012 U292: a new playing epoch needs its own measurement before panels fade in", async () => {
	jest.useFakeTimers();
	const boundary = layoutBoundary({ left: 0, top: 0, width: 1920, height: 1080 });
	const content = (phase: string, epoch: number, id: string) => (
		<div data-runner-content-phase={phase} data-runner-content-epoch={epoch} data-runner-content-id={id}>
			<div data-player-overlay='panel' style={{ opacity: 0 }} />
		</div>
	);
	const view = render(
		<RunnerGeneratedPresentation attributionRequired executionGeneration='playing-layout-check'>
			{content("standby", 0, "")}
		</RunnerGeneratedPresentation>,
	);
	try {
		await flushLayout();
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-content-key", "0:standby:");
		view.rerender(
			<RunnerGeneratedPresentation attributionRequired executionGeneration='playing-layout-check'>
				{content("playback", 1, "next-clip")}
			</RunnerGeneratedPresentation>,
		);
		await flushLayout();
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-content-key", "1:playback:next-clip");
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "blocked");
		expect(screen.getByRole("alert")).toHaveTextContent("Adjust your overlay layout");
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-EXP001 U294: authoritative appearance refresh extends the deadline without replacing the clip", async () => {
	jest.useFakeTimers({ now: 1000000 });
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const previousFetch = globalThis.fetch;
	const fetchPolicy = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ executionGeneration: "renewing-execution", attributionRequired: false, validUntil: new Date(1020000).toISOString() }) });
	Reflect.set(globalThis, "fetch", fetchPolicy);
	const props = { attributionRequired: false, executionGeneration: "renewing-execution", knownPaidUntil: new Date(1010000).toISOString(), policyUrl: "/runner/presentation/renewing-session/policy" };
	const view = render(
		<RunnerGeneratedPresentation {...props}>
			<video data-testid='renewing-clip' />
		</RunnerGeneratedPresentation>,
	);
	const clip = screen.getByTestId("renewing-clip");
	try {
		await act(async () => {
			await Promise.resolve();
		});
		expect(fetchPolicy).toHaveBeenCalledWith(props.policyUrl, expect.objectContaining({ credentials: "same-origin", cache: "no-store", signal: expect.any(AbortSignal) }));
		await act(async () => {
			await jest.advanceTimersByTimeAsync(11000);
		});
		expect(screen.queryByLabelText("Livestream powered by Clipify.us")).not.toBeInTheDocument();
		expect(screen.getByTestId("renewing-clip")).toBe(clip);
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-presentation-generation", "renewing-execution");
		view.unmount();
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		view.unmount();
		Reflect.set(globalThis, "fetch", previousFetch);
		boundary.restore();
		jest.useRealTimers();
	}
});

test.each(["network", "denied", "foreign-generation", "invalid-deadline", "missing-choice", "invalid-choice"])("TDD-US4-EXP001 U294 baseline: %s refresh retains known expiry and cancels its request on unmount", async (kind) => {
	jest.useFakeTimers({ now: 1000000 });
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const previousFetch = globalThis.fetch;
	const policy: Record<string, unknown> = { executionGeneration: "bounded-execution", attributionRequired: false, validUntil: null };
	if (kind === "foreign-generation") policy.executionGeneration = "other-execution";
	if (kind === "invalid-deadline") policy.validUntil = "not-a-deadline";
	if (kind === "missing-choice") delete policy.attributionRequired;
	if (kind === "invalid-choice") policy.attributionRequired = "false";
	const fetchPolicy = kind === "network" ? jest.fn().mockRejectedValue(new TypeError("Offline")) : jest.fn().mockResolvedValue({ ok: kind !== "denied", json: async () => policy });
	Reflect.set(globalThis, "fetch", fetchPolicy);
	const props = { attributionRequired: false, executionGeneration: "bounded-execution", knownPaidUntil: new Date(1001000).toISOString(), policyUrl: "/runner/presentation/bounded-session/policy" };
	const view = render(
		<RunnerGeneratedPresentation {...props}>
			<video data-testid='bounded-clip' />
		</RunnerGeneratedPresentation>,
	);
	const clip = screen.getByTestId("bounded-clip");
	try {
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1000);
		});
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toBeInTheDocument();
		expect(screen.getByTestId("bounded-clip")).toBe(clip);
		const requestSignal = fetchPolicy.mock.calls[0][1].signal as AbortSignal;
		view.unmount();
		expect(requestSignal.aborted).toBe(true);
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		view.unmount();
		Reflect.set(globalThis, "fetch", previousFetch);
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-EXP001 U294 baseline: authoritative indefinite Pro replaces an earlier finite deadline", async () => {
	jest.useFakeTimers({ now: 1000000 });
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const previousFetch = globalThis.fetch;
	const fetchPolicy = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ executionGeneration: "indefinite-execution", attributionRequired: false, validUntil: null }) });
	Reflect.set(globalThis, "fetch", fetchPolicy);
	const props = { attributionRequired: false, executionGeneration: "indefinite-execution", knownPaidUntil: new Date(1001000).toISOString(), policyUrl: "/runner/presentation/indefinite-session/policy" };
	const view = render(
		<RunnerGeneratedPresentation {...props}>
			<video data-testid='indefinite-clip' />
		</RunnerGeneratedPresentation>,
	);
	const clip = screen.getByTestId("indefinite-clip");
	try {
		await act(async () => {
			await jest.advanceTimersByTimeAsync(11000);
		});
		expect(fetchPolicy).toHaveBeenCalledTimes(1);
		expect(screen.queryByLabelText("Livestream powered by Clipify.us")).not.toBeInTheDocument();
		expect(screen.getByTestId("indefinite-clip")).toBe(clip);
		view.unmount();
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		view.unmount();
		Reflect.set(globalThis, "fetch", previousFetch);
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-OPT059 U99: paid standby color follows content phase while preserving the player node", async () => {
	const paid = { runnerPro: true, standbyBackgroundColor: "#16324f" };
	const view = render(
		<RunnerGeneratedPresentation attributionRequired={false} executionGeneration='color-execution' {...paid}>
			<span data-runner-content-phase='standby' data-testid='stable-player' />
		</RunnerGeneratedPresentation>,
	);
	const player = screen.getByTestId("stable-player");
	await act(async () => {
		await Promise.resolve();
	});
	expect(view.container.querySelector("[data-runner-standby]")).toHaveStyle({ backgroundColor: "#16324f" });
	view.rerender(
		<RunnerGeneratedPresentation attributionRequired={false} executionGeneration='color-execution' {...paid}>
			<span data-runner-content-phase='playback' data-testid='stable-player' />
		</RunnerGeneratedPresentation>,
	);
	await act(async () => {
		await Promise.resolve();
	});
	expect(view.container.querySelector("[data-runner-standby]")).toBeNull();
	expect(screen.getByTestId("stable-player")).toBe(player);
	view.unmount();
});

test("TDD-US4-OPT062 U102: saved standby freshness updates plain text without replacing the active player", async () => {
	jest.useFakeTimers();
	const previousFetch = globalThis.fetch;
	const standby = { backgroundColor: "#16324f", backgroundImageUrl: null, logoUrl: null, message: "Updated <3" };
	const policy = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ executionGeneration: "message-freshness", attributionRequired: false, runnerPro: true, validUntil: null, standby }) });
	Reflect.set(globalThis, "fetch", policy);
	const props = { attributionRequired: false, runnerPro: true, executionGeneration: "message-freshness", policyUrl: "/runner/presentation/message-session/policy", standbyMessage: "Before" };
	const view = render(
		<RunnerGeneratedPresentation {...props}>
			<span data-runner-content-phase='standby' data-testid='message-player' />
		</RunnerGeneratedPresentation>,
	);
	const player = screen.getByTestId("message-player");
	try {
		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByText("Updated <3", { exact: true })).toBeVisible();
		expect(view.container.querySelector("[data-runner-standby]")).toHaveStyle({ backgroundColor: "#16324f" });
		expect(screen.getByTestId("message-player")).toBe(player);
		standby.message = "Saved again";
		await act(async () => {
			await jest.advanceTimersByTimeAsync(30000);
		});
		expect(screen.getByText("Saved again", { exact: true })).toBeVisible();
		expect(screen.getByTestId("message-player")).toBe(player);
	} finally {
		view.unmount();
		Reflect.set(globalThis, "fetch", previousFetch);
		jest.useRealTimers();
	}
});

test("TDD-US4-OPT063 U103: standby displays the saved timezone's next start and removes it on paid expiry without replacing content", async () => {
	jest.useFakeTimers({ now: 1800000000000 });
	const boundary = layoutBoundary({ left: 800, top: 500, width: 100, height: 100 });
	const props = { attributionRequired: false, runnerPro: true, executionGeneration: "next-time", knownPaidUntil: new Date(Date.now() + 1000).toISOString(), standbyNextBroadcast: { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" } };
	const view = render(
		<RunnerGeneratedPresentation {...props}>
			<span data-runner-content-phase='standby' data-testid='next-time-player' />
		</RunnerGeneratedPresentation>,
	);
	const player = screen.getByTestId("next-time-player");
	try {
		await flushLayout();
		const time = view.container.querySelector("[data-runner-next-broadcast]");
		expect(time).toHaveAttribute("datetime", props.standbyNextBroadcast.startUtc);
		expect(time).toHaveAttribute("data-timezone", "Europe/Berlin");
		expect(time).toHaveTextContent("14:00");
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1001);
		});
		expect(view.container.querySelector("[data-runner-next-broadcast]")).toBeNull();
		expect(screen.getByTestId("next-time-player")).toBe(player);
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});

test("TDD-US4-SC004 U39: voluntary attribution avoids measured custom standby text without shrinking either surface", async () => {
	jest.useFakeTimers();
	const boundary = layoutBoundary({ left: 1216, top: 916, width: 680, height: 140 });
	const view = render(
		<RunnerGeneratedPresentation attributionRequired runnerPro executionGeneration='standby-message-collision' standbyMessage='Custom standby text'>
			<span data-runner-content-phase='standby' />
		</RunnerGeneratedPresentation>,
	);
	try {
		await flushLayout();
		expect(screen.getByText("Custom standby text", { exact: true })).toBeVisible();
		expect(view.container.firstElementChild).toHaveAttribute("data-runner-layout-status", "placed");
		expect(screen.getByLabelText("Livestream powered by Clipify.us")).toHaveStyle({ left: "24px", top: "24px" });
	} finally {
		view.unmount();
		boundary.restore();
		jest.useRealTimers();
	}
});
