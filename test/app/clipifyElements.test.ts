import { readFileSync } from "node:fs";
import path from "node:path";

const moduleSource = readFileSync(path.join(process.cwd(), "public/elements/v1/clipify.js"), "utf8").replace("new URL(import.meta.url)", 'new URL("https://clipify.us/elements/v1/clipify.js")');

function installElements() {
	window.eval(moduleSource);
}

type TestPort = {
	start: jest.Mock;
	close: jest.Mock;
	postMessage: jest.Mock;
	onmessage: ((event: MessageEvent) => void) | null;
};

const channels: Array<{ port1: TestPort; port2: TestPort }> = [];

function makePort(): TestPort {
	return { start: jest.fn(), close: jest.fn(), postMessage: jest.fn(), onmessage: null };
}

function attachFrameWindow(frame: HTMLIFrameElement) {
	const postMessage = jest.fn();
	Object.defineProperty(frame, "contentWindow", { configurable: true, value: { postMessage } });
	return postMessage;
}

describe("Clipify Elements v1", () => {
	beforeAll(() => {
		Object.defineProperty(window, "MessageChannel", {
			configurable: true,
			value: class {
				port1 = makePort();
				port2 = makePort();
				constructor() {
					channels.push(this);
				}
			},
		});
		Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
			configurable: true,
			value: function (this: HTMLDialogElement) {
				this.setAttribute("open", "");
			},
		});
		Object.defineProperty(HTMLDialogElement.prototype, "close", {
			configurable: true,
			value: function (this: HTMLDialogElement) {
				this.removeAttribute("open");
			},
		});
		Object.defineProperty(window, "matchMedia", { configurable: true, value: jest.fn(() => ({ matches: true })) });
		installElements();
	});

	beforeEach(() => {
		document.body.innerHTML = "";
		document.documentElement.style.overflow = "";
		channels.length = 0;
		jest.useRealTimers();
	});

	it("renders clear integration errors when resource IDs are missing", () => {
		const gallery = document.createElement("clipify-gallery");
		const player = document.createElement("clipify-player");
		document.body.append(gallery, player);
		expect(gallery.shadowRoot?.textContent).toContain("A gallery-id is required.");
		expect(player.shadowRoot?.textContent).toContain("A player-id is required.");
	});

	it("is safe to load repeatedly", () => {
		expect(() => installElements()).not.toThrow();
		expect(customElements.get("clipify-gallery")).toBeDefined();
		expect(customElements.get("clipify-player")).toBeDefined();
	});

	it("renders a transparent, responsive gallery frame and reacts to ID changes", () => {
		const element = document.createElement("clipify-gallery");
		element.setAttribute("gallery-id", "gallery-one");
		document.body.append(element);
		const firstFrame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		expect(firstFrame.src).toBe("https://clipify.us/gallery/gallery-one/frame");
		expect(firstFrame.referrerPolicy).toBe("strict-origin");

		element.setAttribute("gallery-id", "gallery-two");
		const nextFrame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		expect(nextFrame).not.toBe(firstFrame);
		expect(nextFrame.src).toBe("https://clipify.us/gallery/gallery-two/frame");
	});

	it("keeps Clip Player iframe compatibility and maps boolean options", () => {
		const element = document.createElement("clipify-player");
		element.setAttribute("player-id", "player-one");
		element.setAttribute("muted", "");
		element.setAttribute("autoplay", "");
		document.body.append(element);
		const frame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		expect(frame.src).toBe("https://clipify.us/embed/player-one?muted=true&autoplay=true");
		expect(frame.allow).toBe("autoplay");
		element.setAttribute("show-banner", "");
		element.setAttribute("show-overlay", "");
		expect((element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement).src).toContain("showBanner=true&showOverlay=true");
	});

	it("handshakes through a private channel and validates gallery messages", () => {
		const element = document.createElement("clipify-gallery");
		element.setAttribute("gallery-id", "gallery-one");
		document.body.append(element);
		const frame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		const postMessage = attachFrameWindow(frame);
		frame.dispatchEvent(new Event("load"));
		const channel = channels.at(-1)!;
		expect(channel.port1.start).toHaveBeenCalled();
		expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "clipify:init", elementType: "gallery", resourceId: "gallery-one" }), "https://clipify.us", [channel.port2]);

		channel.port1.onmessage?.({ data: { version: 2, type: "resize", elementType: "gallery", resourceId: "gallery-one", height: 700 } } as MessageEvent);
		expect(frame.style.height).toBe("");
		channel.port1.onmessage?.({ data: { version: 1, type: "resize", elementType: "gallery", resourceId: "gallery-one", height: 12_000 } } as MessageEvent);
		expect(frame.style.height).toBe("10000px");
		channel.port1.onmessage?.({ data: { version: 1, type: "resize", elementType: "gallery", resourceId: "gallery-one", height: 1 } } as MessageEvent);
		expect(frame.style.height).toBe("120px");
	});

	it("opens and closes the host dialog while restoring scroll and card focus", () => {
		jest.useFakeTimers();
		document.documentElement.style.overflow = "scroll";
		const element = document.createElement("clipify-gallery");
		element.setAttribute("gallery-id", "gallery-one");
		document.body.append(element);
		const galleryFrame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		attachFrameWindow(galleryFrame);
		galleryFrame.dispatchEvent(new Event("load"));
		const galleryPort = channels.at(-1)!.port1;
		galleryPort.onmessage?.({ data: { version: 1, type: "ready", elementType: "gallery", resourceId: "gallery-one", allowRuntimeStyles: false } } as MessageEvent);
		galleryPort.onmessage?.({ data: { version: 1, type: "selected-clip", elementType: "gallery", resourceId: "gallery-one", clipId: "clip-one" } } as MessageEvent);

		const dialog = document.querySelector("dialog[data-clipify-dialog=v1]") as HTMLDialogElement;
		const playerFrame = dialog.querySelector("iframe") as HTMLIFrameElement;
		expect(playerFrame.src).toBe("https://clipify.us/gallery/gallery-one/clip/clip-one");
		expect(document.documentElement.style.overflow).toBe("hidden");
		const fallback = dialog.querySelector("button") as HTMLButtonElement;
		expect(fallback.hidden).toBe(true);
		jest.advanceTimersByTime(8000);
		expect(fallback.hidden).toBe(false);

		attachFrameWindow(playerFrame);
		playerFrame.dispatchEvent(new Event("load"));
		const playerPort = channels.at(-1)!.port1;
		playerPort.onmessage?.({ data: { version: 1, type: "resize", elementType: "player", resourceId: "gallery-one", height: 500 } } as MessageEvent);
		expect(dialog.style.height).toBe("500px");
		playerPort.onmessage?.({ data: { version: 1, type: "close", elementType: "player", resourceId: "gallery-one" } } as MessageEvent);
		expect(document.querySelector("dialog")).toBeNull();
		expect(document.documentElement.style.overflow).toBe("scroll");
		expect(galleryPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "restore-focus" }));
	});

	it("closes ports and frames when elements disconnect", () => {
		const element = document.createElement("clipify-gallery");
		element.setAttribute("gallery-id", "gallery-one");
		document.body.append(element);
		const frame = element.shadowRoot?.querySelector("iframe") as HTMLIFrameElement;
		attachFrameWindow(frame);
		frame.dispatchEvent(new Event("load"));
		const port = channels.at(-1)!.port1;
		element.remove();
		expect(port.close).toHaveBeenCalled();
		expect(element.shadowRoot?.querySelector("iframe")).toBeNull();
	});

	it("pins production messages to the module origin and never uses a wildcard target", () => {
		expect(moduleSource).toContain("CLIPIFY_ORIGIN");
		expect(moduleSource).not.toMatch(/postMessage\([^)]*,\s*["']\*["']/s);
		expect(moduleSource).toContain('document.createElement("dialog")');
	});

	it("does not overwrite host-page overflow when no gallery dialog owns the scroll lock", () => {
		document.documentElement.style.overflow = "scroll";
		const element = document.createElement("clipify-gallery");
		element.setAttribute("gallery-id", "gallery-one");
		document.body.append(element);
		element.remove();
		expect(document.documentElement.style.overflow).toBe("scroll");
	});

	it("bridges modal variables only after runtime styling is allowed", () => {
		expect(moduleSource).not.toContain("var(--clipify-modal-width");
		expect(moduleSource).not.toContain("var(--clipify-modal-backdrop");
		expect(moduleSource).toContain('if (runtime["--clipify-modal-width"])');
		expect(moduleSource).toContain('if (runtime["--clipify-modal-backdrop"])');
	});
});
