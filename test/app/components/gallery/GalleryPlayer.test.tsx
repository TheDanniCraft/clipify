import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GalleryPlayer from "@components/gallery/GalleryPlayer";
import { buildClip, buildGallery } from "../../gallery/fixtures";

const plausible = jest.fn();
const carouselApi = { on: jest.fn(), off: jest.fn(), selectedScrollSnap: jest.fn(() => 0), scrollPrev: jest.fn(), scrollNext: jest.fn() };
let selectCallback: (() => void) | undefined;

jest.mock("next-plausible", () => ({ usePlausible: () => plausible }));
jest.mock(
	"@heroui-pro/react/carousel",
	() => {
		const React = require("react");
		const Part = ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>;
		function Root({ children, setApi }: { children?: React.ReactNode; setApi?: (api: unknown) => void }) {
			React.useEffect(() => setApi?.(carouselApi), [setApi]);
			return <div>{children}</div>;
		}
		const Carousel = Object.assign(Root, { Content: Part, Item: Part, Previous: () => <button>Previous</button>, Next: () => <button>Next</button>, Dots: () => <div>Dots</div> });
		return { Carousel };
	},
	{ virtual: true },
);

let resizeCallback: ResizeObserverCallback;
const resizeDisconnect = jest.fn();

describe("GalleryPlayer", () => {
	const clips = [buildClip("one", { title: "First", duration: 70 }), buildClip("two", { title: "Second", duration: 80 }), buildClip("three", { title: "Third", duration: 90 })];
	const play = jest.fn();
	const pause = jest.fn();

	beforeAll(() => {
		Object.defineProperty(global, "ResizeObserver", {
			configurable: true,
			value: class {
				constructor(callback: ResizeObserverCallback) {
					resizeCallback = callback;
				}
				observe() {}
				disconnect() {
					resizeDisconnect();
				}
			},
		});
		Object.defineProperty(window, "requestAnimationFrame", {
			configurable: true,
			value: (callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			},
		});
		Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: jest.fn() });
		Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
		Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
	});

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		selectCallback = undefined;
		carouselApi.on.mockImplementation((_event, callback) => {
			selectCallback = callback;
		});
		play.mockImplementation(function (this: HTMLMediaElement) {
			fireEvent.play(this);
			return Promise.resolve();
		});
		pause.mockImplementation(function (this: HTMLMediaElement) {
			fireEvent.pause(this);
		});
		Object.defineProperty(document, "referrer", { configurable: true, value: "https://host.example/page" });
		global.fetch = jest.fn();
		window.open = jest.fn();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	it("renders only active media, tracks playback, and updates all media controls", async () => {
		const { container } = render(<GalleryPlayer gallery={buildGallery({ desktopModalWidth: 900 })} clips={clips} initialIndex={0} initialPlaybackUrl='https://video.example/one.mp4' ownerName='Alice' showAttribution />);
		const video = container.querySelector("video") as HTMLVideoElement;
		expect(video).toHaveAttribute("src", "https://video.example/one.mp4");
		expect(video.volume).toBe(0.8);
		expect(container.querySelectorAll("video")).toHaveLength(1);
		expect(container.querySelectorAll("img")).toHaveLength(1);
		expect(screen.getByText("First")).toBeInTheDocument();
		expect(screen.getByText(/Clip gallery by Alice/)).toBeInTheDocument();

		Object.defineProperty(video, "paused", { configurable: true, value: true });
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		await act(async () => undefined);
		expect(play).toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
		fireEvent.playing(video);
		act(() => jest.advanceTimersByTime(4_999));
		expect(plausible).not.toHaveBeenCalledWith("clip_played", expect.anything());
		act(() => jest.advanceTimersByTime(1));
		expect(plausible).toHaveBeenCalledWith("clip_played", expect.objectContaining({ props: expect.objectContaining({ galleryId: "gallery-1", clipId: "one" }) }));
		Object.defineProperty(video, "paused", { configurable: true, value: false });
		fireEvent.click(screen.getByRole("button", { name: "Pause" }));
		expect(pause).toHaveBeenCalled();

		Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 12.4 });
		Object.defineProperty(video, "duration", { configurable: true, value: 75 });
		fireEvent.timeUpdate(video);
		fireEvent.durationChange(video);
		expect(screen.getByText("0:12 / 1:15")).toBeInTheDocument();
		Object.defineProperty(video, "duration", { configurable: true, value: 0 });
		fireEvent.durationChange(video);
		expect(screen.getByText("0:12 / 1:10")).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Seek"), { target: { value: "20" } });
		expect(video.currentTime).toBe(20);

		fireEvent.click(screen.getByRole("button", { name: "Mute" }));
		expect(video.muted).toBe(true);
		fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0" } });
		expect(video.volume).toBe(0);
		expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.5" } });
		expect(video.volume).toBe(0.5);
	});

	it("loads missing playback, handles media errors, retries, and opens Twitch", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ playbackUrl: "https://video.example/one.mp4" }) });
		const { container } = render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl={null} ownerName='Alice' showAttribution={false} />);
		expect(screen.getByText("Loading clip…")).toBeInTheDocument();
		await act(async () => jest.runOnlyPendingTimers());
		await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "https://video.example/one.mp4"));
		expect(global.fetch).toHaveBeenCalledWith("/api/gallery/gallery-1/clip/one", { credentials: "omit" });

		fireEvent.error(container.querySelector("video") as HTMLVideoElement);
		expect(await screen.findByText("Playback failed.")).toBeInTheDocument();
		(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ playbackUrl: null }) });
		fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
		await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
		await screen.findByText("Playback failed.");
		fireEvent.click(screen.getByRole("button", { name: "Watch on Twitch" }));
		expect(window.open).toHaveBeenCalledWith(clips[0].url, "_blank", "noopener,noreferrer");
	});

	it("shows the fallback for HTTP and network failures and handles rejected autoplay", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
		render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl={null} ownerName='Alice' showAttribution={false} />);
		await act(async () => jest.runOnlyPendingTimers());
		expect(await screen.findByText("Playback failed.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		fireEvent.change(screen.getByLabelText("Seek"), { target: { value: "5" } });
		fireEvent.click(screen.getByRole("button", { name: "Mute" }));
		fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.4" } });

		(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
		fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
		await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

		const video = document.querySelector("video") as HTMLVideoElement | null;
		if (video) {
			Object.defineProperty(video, "paused", { configurable: true, value: true });
			play.mockRejectedValueOnce(new Error("blocked"));
			fireEvent.click(screen.getByRole("button", { name: "Play" }));
			await act(async () => undefined);
			expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
		}
	});

	it("keeps click-to-play available when the browser rejects playback and tolerates an invalid referrer", async () => {
		Object.defineProperty(document, "referrer", { configurable: true, value: "not a URL" });
		play.mockRejectedValueOnce(new Error("blocked"));
		const { container } = render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl='https://video.example/one.mp4' ownerName='Alice' showAttribution={false} />);
		const video = container.querySelector("video") as HTMLVideoElement;
		Object.defineProperty(video, "paused", { configurable: true, value: true });
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		await act(async () => undefined);
		expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
	});

	it("renders safely without a parent referrer", () => {
		Object.defineProperty(document, "referrer", { configurable: true, value: "" });
		const { unmount } = render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl='https://video.example/one.mp4' ownerName='Alice' showAttribution={false} />);
		unmount();
	});

	it("navigates through the carousel, ignores form key events, and releases old media", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ playbackUrl: "https://video.example/two.mp4" }) });
		const { container, unmount } = render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl='https://video.example/one.mp4' ownerName='Alice' showAttribution={false} />);
		await waitFor(() => expect(carouselApi.on).toHaveBeenCalledWith("select", expect.any(Function)));
		fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.35" } });
		carouselApi.selectedScrollSnap.mockReturnValueOnce(1);
		act(() => selectCallback?.());
		expect(pause).toHaveBeenCalled();
		expect(screen.getByText("Second")).toBeInTheDocument();
		expect(screen.getByText("0:00 / 1:20")).toBeInTheDocument();
		await waitFor(() => expect((container.querySelector("video") as HTMLVideoElement | null)?.volume).toBe(0.35));

		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(carouselApi.scrollPrev).toHaveBeenCalled();
		expect(carouselApi.scrollNext).toHaveBeenCalled();
		const input = screen.getByLabelText("Seek");
		fireEvent.keyDown(input, { key: "ArrowRight" });
		expect(carouselApi.scrollNext).toHaveBeenCalledTimes(1);

		unmount();
		expect(carouselApi.off).toHaveBeenCalledWith("select", expect.any(Function));
		expect(resizeDisconnect).toHaveBeenCalled();
		expect(container.querySelector("video")).toBeNull();
	});

	it("validates the parent channel, reports size and sequence, closes, and cleans up", () => {
		const port = { start: jest.fn(), close: jest.fn(), postMessage: jest.fn(), onmessage: null };
		const { container, unmount } = render(<GalleryPlayer gallery={buildGallery()} clips={clips} initialIndex={0} initialPlaybackUrl='https://video.example/one.mp4' ownerName='Alice' showAttribution={false} />);
		const surface = container.querySelector("section") as HTMLElement;
		Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 500 });

		act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://wrong.example", source: window, data: { version: 1, type: "clipify:init", elementType: "player", resourceId: "gallery-1", clipId: "one" }, ports: [port as unknown as MessagePort] })));
		expect(port.start).not.toHaveBeenCalled();
		act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://host.example", source: window, data: { version: 1, type: "clipify:init", elementType: "player", resourceId: "gallery-1", clipId: "one" }, ports: [port as unknown as MessagePort] })));
		expect(port.start).toHaveBeenCalled();
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "ready", clipId: "one" }));
		act(() => {
			resizeCallback([], {} as ResizeObserver);
			jest.runOnlyPendingTimers();
		});
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "resize", height: 500 }));
		const resizeCalls = port.postMessage.mock.calls.length;
		act(() => {
			resizeCallback([], {} as ResizeObserver);
			jest.runOnlyPendingTimers();
		});
		expect(port.postMessage).toHaveBeenCalledTimes(resizeCalls);
		fireEvent.keyDown(window, { key: "Escape" });
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "close" }));
		fireEvent.click(screen.getByRole("button", { name: "Close player" }));
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "close" }));
		unmount();
		expect(port.close).toHaveBeenCalled();
	});
});
