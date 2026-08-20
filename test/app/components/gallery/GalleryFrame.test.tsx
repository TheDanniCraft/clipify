import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import GalleryFrame from "@components/gallery/GalleryFrame";
import { buildClip, buildGallery } from "../../gallery/fixtures";

jest.mock(
	"@heroui-pro/react/carousel",
	() => {
		const React = require("react");
		const Part = ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>;
		const Carousel = Object.assign(Part, { Content: Part, Item: Part, Previous: () => <button>Previous</button>, Next: () => <button>Next</button>, Dots: () => <div>Dots</div> });
		return { Carousel };
	},
	{ virtual: true },
);

let resizeCallback: ResizeObserverCallback;
const observe = jest.fn();
const disconnect = jest.fn();

describe("GalleryFrame", () => {
	beforeAll(() => {
		Object.defineProperty(global, "ResizeObserver", {
			configurable: true,
			value: class {
				constructor(callback: ResizeObserverCallback) {
					resizeCallback = callback;
				}
				observe = observe;
				disconnect = disconnect;
			},
		});
		Object.defineProperty(global, "CSS", { configurable: true, value: { supports: jest.fn((_kind: string, value: string) => value !== "invalid") } });
	});

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		Object.defineProperty(document, "referrer", { configurable: true, value: "https://host.example/page" });
		Object.defineProperty(document.documentElement, "getBoundingClientRect", { configurable: true, value: jest.fn(() => ({ height: 420 })) });
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	it("renders grid metadata, safe Free styling, selection, and attribution", () => {
		const onSelectClip = jest.fn();
		const clip = buildClip("one");
		const { container } = render(<GalleryFrame gallery={buildGallery({ accentColor: "#123456", cardRadius: 30, gap: 40, backgroundMode: "solid", backgroundColor: "#ffffff", thumbnailTreatment: "contain" })} clips={[clip]} ownerName='Alice' showAttribution onSelectClip={onSelectClip} />);

		expect(screen.getByText("Clip one")).toBeInTheDocument();
		expect(screen.getByText("Creator one")).toBeInTheDocument();
		expect(screen.getByText((content) => /^1[.,]234 views$/.test(content))).toBeInTheDocument();
		expect(screen.getByText("1:05")).toBeInTheDocument();
		expect(screen.queryByRole("time")).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Clips from Alice/i })).toHaveAttribute("href", expect.stringContaining("utm_campaign=gallery-1"));
		const main = container.querySelector("main") as HTMLElement;
		expect(main.style.getPropertyValue("--clipify-accent")).toBe("#7C3AED");
		expect(main.style.getPropertyValue("--clipify-radius")).toBe("16px");
		expect(main.style.getPropertyValue("--clipify-background")).toBe("transparent");

		fireEvent.click(screen.getByRole("button", { name: "Play Clip one" }));
		expect(onSelectClip).toHaveBeenCalledWith(clip);
	});

	it("renders list, carousel, empty, and optional metadata variants", () => {
		const clip = buildClip("one");
		const { rerender } = render(<GalleryFrame gallery={buildGallery({ layout: "list", listDensity: "compact", showTitle: false, showCreator: false, showViews: false, showDuration: false, showCreatedAt: true })} clips={[clip]} ownerName='Alice' showAttribution={false} />);
		expect(screen.queryByText("Clip one")).not.toBeInTheDocument();
		expect(screen.queryByText("Creator one")).not.toBeInTheDocument();
		expect(screen.queryByText(/views/)).not.toBeInTheDocument();
		expect(screen.getByRole("time")).toHaveAttribute("datetime", clip.created_at);
		expect(screen.getByRole("time")).toHaveTextContent("Aug 1, 2026");
		expect(screen.queryByText(/Powered by Clipify/)).not.toBeInTheDocument();

		rerender(<GalleryFrame gallery={buildGallery({ layout: "carousel", carouselShowNavigation: true, carouselShowIndicators: true })} clips={[clip]} ownerName='Alice' showAttribution={false} />);
		expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
		expect(screen.getByText("Dots")).toBeInTheDocument();

		rerender(<GalleryFrame gallery={buildGallery({ layout: "carousel" })} clips={[]} ownerName='Alice' showAttribution={false} />);
		expect(screen.getByText("No clips are available yet.")).toBeInTheDocument();
		expect(screen.queryByText("Dots")).not.toBeInTheDocument();
	});

	it("accepts only a validated parent handshake, applies Pro runtime styles, resizes, and restores focus", () => {
		const port = { start: jest.fn(), close: jest.fn(), postMessage: jest.fn(), onmessage: null as null | ((event: MessageEvent) => void) };
		const { container } = render(<GalleryFrame gallery={buildGallery()} clips={[buildClip("one")]} ownerName='Alice' showAttribution={false} />);
		const button = screen.getByRole("button", { name: "Play Clip one" });
		button.focus();

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { origin: "https://wrong.example", source: window, data: { version: 1, type: "clipify:init", elementType: "gallery", resourceId: "gallery-1" }, ports: [port as unknown as MessagePort] }));
		});
		expect(port.start).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { origin: "https://host.example", source: window, data: { version: 1, type: "clipify:init", elementType: "gallery", resourceId: "gallery-1", styles: { "--clipify-accent": "#123456", "--clipify-card-surface": "invalid", "--clipify-text": "#ffffff", "--clipify-background": "#000000", "--clipify-radius": "22px", "--clipify-gap": "bad" } }, ports: [port as unknown as MessagePort] }));
		});
		expect(port.start).toHaveBeenCalled();
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "ready", allowRuntimeStyles: true }));
		const main = container.querySelector("main") as HTMLElement;
		expect(main.style.getPropertyValue("--clipify-accent")).toBe("#123456");
		expect(main.style.getPropertyValue("--clipify-card")).toBe("#18181B");
		expect(main.style.getPropertyValue("--clipify-radius")).toBe("22px");

		act(() => {
			resizeCallback([], {} as ResizeObserver);
			jest.advanceTimersByTime(80);
		});
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "resize", height: 420 }));
		act(() => {
			resizeCallback([], {} as ResizeObserver);
			jest.advanceTimersByTime(80);
		});
		expect(port.postMessage.mock.calls.filter(([message]) => message.type === "resize")).toHaveLength(1);

		fireEvent.click(button);
		expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "selected-clip", clipId: "one" }));
		act(() => port.onmessage?.(new MessageEvent("message", { data: { version: 0, elementType: "gallery", resourceId: "gallery-1", type: "restore-focus" } })));
		expect(document.activeElement).toBe(button);
		button.blur();
		act(() => port.onmessage?.(new MessageEvent("message", { data: { version: 1, elementType: "gallery", resourceId: "gallery-1", type: "restore-focus" } })));
		expect(document.activeElement).toBe(button);
	});

	it("ignores invalid referrers and Free runtime styles and cleans resources", () => {
		Object.defineProperty(document, "referrer", { configurable: true, value: "not a url" });
		const port = { start: jest.fn(), close: jest.fn(), postMessage: jest.fn(), onmessage: null };
		const { unmount } = render(<GalleryFrame gallery={buildGallery()} clips={[buildClip("one")]} ownerName='Alice' showAttribution />);
		act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://host.example", source: window, data: { version: 1, type: "clipify:init", elementType: "gallery", resourceId: "gallery-1", styles: { "--clipify-accent": "#123456" } }, ports: [port as unknown as MessagePort] })));
		expect(port.start).not.toHaveBeenCalled();

		act(() => resizeCallback([], {} as ResizeObserver));
		unmount();
		expect(disconnect).toHaveBeenCalled();
		expect(observe).toHaveBeenCalledWith(document.documentElement);
	});
});
