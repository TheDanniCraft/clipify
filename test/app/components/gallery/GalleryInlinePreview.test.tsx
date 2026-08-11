import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import GalleryInlinePreview from "@components/gallery/GalleryInlinePreview";
import { buildClip, buildGallery } from "../../gallery/fixtures";

jest.mock("@components/gallery/GalleryFrame", () => ({
	__esModule: true,
	default: ({ clips, onSelectClip }: { clips: ReturnType<typeof buildClip>[]; onSelectClip: (clip: ReturnType<typeof buildClip>) => void }) => <button onClick={() => onSelectClip(clips[0])}>Open first clip</button>,
}));

describe("GalleryInlinePreview", () => {
	const showModal = jest.fn();
	const close = jest.fn();

	beforeAll(() => {
		Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
		Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close });
		Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => callback(0) });
	});

	beforeEach(() => {
		jest.clearAllMocks();
		showModal.mockImplementation(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		close.mockImplementation(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("renders a website preview and opens the selected clip in the dashboard player frame", () => {
		const gallery = buildGallery({ id: "gallery / one", desktopModalWidth: 880, modalBackdrop: "rgba(1,2,3,.5)" });
		const clip = buildClip("clip / one", { title: "Selected clip" });
		const { container } = render(<GalleryInlinePreview gallery={gallery} clips={[clip]} ownerName='Alice' showAttribution />);
		expect(screen.getByText("Website preview")).toBeInTheDocument();
		expect(screen.getByText("Featured clips")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Open first clip" }));
		expect(showModal).toHaveBeenCalled();
		const frame = screen.getByTitle("Playing Selected clip");
		expect(frame).toHaveAttribute("src", "/dashboard/galleries/gallery%20%2F%20one/preview/clip/clip%20%2F%20one");
		expect(frame).toHaveAttribute("allow", "autoplay");
		const dialog = container.querySelector("dialog") as HTMLDialogElement;
		expect(dialog.style.getPropertyValue("--gallery-modal-width")).toBe("880px");
		expect(dialog.style.getPropertyValue("--gallery-backdrop")).toBe("rgba(1,2,3,.5)");
	});

	it("closes and removes the player through the button and native dialog close", () => {
		const { container } = render(<GalleryInlinePreview gallery={buildGallery()} clips={[buildClip("one")]} ownerName='Alice' showAttribution={false} />);
		fireEvent.click(screen.getByRole("button", { name: "Open first clip" }));
		fireEvent.click(screen.getByRole("button", { name: "Close player" }));
		expect(close).toHaveBeenCalled();
		expect(screen.queryByTitle(/Playing/)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Open first clip" }));
		act(() => container.querySelector("dialog")?.dispatchEvent(new Event("close", { bubbles: false })));
		expect(screen.queryByTitle(/Playing/)).not.toBeInTheDocument();
	});
});
