import { readFileSync } from "node:fs";
import path from "node:path";

const moduleSource = readFileSync(path.join(process.cwd(), "public/elements/v1/clipify.js"), "utf8").replace("new URL(import.meta.url)", 'new URL("https://clipify.us/elements/v1/clipify.js")');

function installElements() {
	window.eval(moduleSource);
}

describe("Clipify Elements v1", () => {
	beforeAll(() => {
		installElements();
	});

	beforeEach(() => {
		document.body.innerHTML = "";
		document.documentElement.style.overflow = "";
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
