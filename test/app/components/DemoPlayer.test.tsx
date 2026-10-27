/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DemoPlayer from "@/app/components/DemoPlayer";

const mockPlausible = jest.fn();
jest.mock("next-plausible", () => ({ usePlausible: () => mockPlausible }));

let visibility: IntersectionObserverCallback;
const disconnect = jest.fn();

beforeEach(() => {
	jest.useFakeTimers();
	mockPlausible.mockClear();
	Object.defineProperty(document, "hidden", { configurable: true, value: false });
	global.IntersectionObserver = jest.fn((callback) => {
		visibility = callback;
		return { observe: jest.fn(), disconnect, unobserve: jest.fn() };
	}) as unknown as typeof IntersectionObserver;
});
afterEach(() => jest.useRealTimers());

function play() {
	fireEvent.click(screen.getByRole("button", { name: "Watch the demo" }));
	return screen.getByTitle("Clipify playback demo") as HTMLIFrameElement;
}

function signalPlayback(iframe: HTMLIFrameElement) {
	fireEvent.load(iframe);
	act(() => iframe.contentDocument!.dispatchEvent(new Event("playing")));
}

describe("homepage playback demo", () => {
	it("does not load the player before an explicit play action", () => {
		render(<DemoPlayer />);
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Watch the demo" })).toBeVisible();
		const iframe = play();
		expect(iframe).toHaveAttribute("src", "/demoPlayer");
		expect(mockPlausible).toHaveBeenCalledWith("demo_requested", { props: { placement: "hero", action: "start" } });
		expect(screen.getByRole("status")).toHaveTextContent("Loading your clip preview");
	});

	it("waits for real playback rather than treating iframe load as success", () => {
		render(<DemoPlayer />);
		const iframe = play();
		fireEvent.load(iframe);
		expect(screen.getByText("Loading your clip preview…")).toBeVisible();
		act(() => iframe.contentDocument!.dispatchEvent(new Event("playing")));
		expect(screen.queryByText("Loading your clip preview…")).not.toBeInTheDocument();
		act(() => jest.advanceTimersByTime(20_000));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("recognizes a video that started before the iframe load callback", () => {
		render(<DemoPlayer />);
		const iframe = play();
		const playerDocument = document.implementation.createHTMLDocument();
		const video = playerDocument.createElement("video");
		Object.defineProperties(video, { paused: { value: false }, readyState: { value: 2 } });
		playerDocument.body.append(video);
		Object.defineProperty(iframe, "contentDocument", { value: playerDocument });
		fireEvent.load(iframe);
		expect(screen.queryByText("Loading your clip preview…")).not.toBeInTheDocument();
	});

	it("unmounts playback offscreen and resumes only on intent", () => {
		render(<DemoPlayer />);
		signalPlayback(play());
		act(() => visibility([{ isIntersecting: false }, { isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
		expect(screen.getByTitle("Clipify playback demo")).toBeInTheDocument();
		act(() => visibility([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
		act(() => visibility([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Resume demo" }));
		expect(screen.getByTitle("Clipify playback demo")).toBeInTheDocument();
	});

	it("stops playback when the tab is hidden and when paused manually", () => {
		render(<DemoPlayer />);
		play();
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		fireEvent(document, new Event("visibilitychange"));
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
		fireEvent(document, new Event("visibilitychange"));
		fireEvent.click(screen.getByRole("button", { name: "Resume demo" }));
		fireEvent.click(screen.getByRole("button", { name: "Pause demo" }));
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
	});

	it("offers a fresh retry when media does not become playable", () => {
		render(<DemoPlayer />);
		play();
		act(() => jest.advanceTimersByTime(20_000));
		expect(screen.getByRole("alert")).toBeVisible();
		expect(screen.queryByTitle("Clipify playback demo")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Try demo again" }));
		signalPlayback(screen.getByTitle("Clipify playback demo") as HTMLIFrameElement);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("reports missing demo configuration without pretending playback succeeded", () => {
		render(<DemoPlayer />);
		const iframe = play();
		iframe.contentDocument!.write("<body>Overlay not found</body>");
		fireEvent.load(iframe);
		expect(screen.getByRole("alert")).toBeVisible();
	});

	it("cleans up the observer and playback timeout on unmount", () => {
		const { unmount } = render(<DemoPlayer />);
		play();
		unmount();
		expect(disconnect).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});
});
