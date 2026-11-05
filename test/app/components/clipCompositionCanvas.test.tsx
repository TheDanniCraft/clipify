import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import Canvas from "@components/creator/clipCompositionCanvas";
import { createClipComposition } from "@lib/clipComposition";
const preview = jest.fn();
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...a: unknown[]) => preview(...a) }));
jest.mock("@components/creator/clipCompositionBox", () => ({
	__esModule: true,
	default: ({ label, onSelect, onChange, rect }: any) => (
		<button
			aria-label={label}
			onClick={() => {
				onSelect();
				onChange({ ...rect, x: 0.01 });
			}}
		/>
	),
}));
let frames: FrameRequestCallback[] = [];
const ctx = { fillRect: jest.fn(), drawImage: jest.fn(), save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(), rect: jest.fn(), clip: jest.fn(), measureText: jest.fn(() => ({ width: 60 })), fillText: jest.fn() };
const clip = { id: "ClipA", title: "A moment", broadcasterName: "Channel", clipCreatorName: "Maker" };
beforeEach(() => {
	jest.clearAllMocks();
	frames = [];
	preview.mockResolvedValue({ playbackUrl: "https://media.invalid/source.mp4" });
	jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
		frames.push(cb);
		return frames.length;
	});
	jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
	jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
});
afterEach(() => jest.restoreAllMocks());
async function ready() {
	await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", "https://media.invalid/source.mp4"));
	const video = document.querySelector("video")!;
	Object.defineProperties(video, { videoWidth: { configurable: true, value: 1920 }, videoHeight: { configurable: true, value: 1080 }, readyState: { configurable: true, value: 2 }, duration: { configurable: true, value: 12 } });
	fireEvent.loadedMetadata(video);
	fireEvent.loadedData(video);
	return video;
}
it("draws actual crops and widgets and keeps media loaded when layout changes", async () => {
	const change = jest.fn(),
		select = jest.fn(),
		dimensions = jest.fn(),
		layout = createClipComposition("mobile");
	layout.layers.push({ id: "title", label: "Clip title", kind: "title", fontSize: 32, frame: { x: 0, y: 0, w: 1, h: 0.1 } });
	const view = render(<Canvas creatorId='owner' clip={clip} layout={layout} selected='camera' onSelect={select} onChange={change} onDimensions={dimensions} />);
	const sourceVideo = await ready();
	act(() => frames.shift()!(0));
	expect(ctx.drawImage).toHaveBeenCalledTimes(2);
	expect(ctx.drawImage).toHaveBeenNthCalledWith(1, sourceVideo, 1440, 20, 480, 284, 0, 0, 720, 426);
	expect(ctx.fillText).toHaveBeenCalledWith("A moment", 0, 0);
	expect(dimensions).toHaveBeenCalledWith({ width: 1920, height: 1080 });
	fireEvent.click(screen.getByRole("button", { name: "Camera crop" }));
	expect(change).toHaveBeenCalled();
	expect(select).toHaveBeenCalledWith("camera");
	view.rerender(<Canvas creatorId='owner' clip={clip} layout={{ ...layout, layers: layout.layers.slice(0, 2) }} selected='camera' onSelect={select} onChange={change} onDimensions={dimensions} />);
	expect(preview).toHaveBeenCalledTimes(1);
});
it("recovers expired media without losing its layout", async () => {
	const layout = createClipComposition("desktop");
	render(<Canvas creatorId='owner' clip={clip} layout={layout} selected='gameplay' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	const video = await ready();
	fireEvent.error(video);
	expect(screen.getByRole("button", { name: "Play preview" })).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(preview).toHaveBeenLastCalledWith({ creatorId: "owner", clipId: "ClipA", refresh: true }));
	expect(document.querySelector("canvas")).toBeInTheDocument();
});
it("shows an actionable preview retry after lookup failure", async () => {
	preview.mockRejectedValue(Error("offline"));
	render(<Canvas creatorId='owner' clip={clip} layout={createClipComposition("mobile")} selected='camera' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	expect(await screen.findByRole("button", { name: "Retry preview" })).toBeVisible();
	expect(document.querySelector("canvas")).toBeInTheDocument();
});
it("draws the channel logo from the authorized image proxy and offers recovery if it fails", async () => {
	const images: any[] = [];
	jest.spyOn(window, "Image").mockImplementation(() => {
		const image = { width: 100, height: 100, onload: null, onerror: null, src: "" };
		images.push(image);
		return image as never;
	});
	const layout = createClipComposition("desktop");
	layout.layers.push({ id: "logo", kind: "logo", label: "Logo", frame: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
	render(<Canvas creatorId='owner' clip={clip} layout={layout} selected='logo' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	await ready();
	expect(images[0].src).toContain("/api/clips/layout-logo?creatorId=owner");
	act(() => images[0].onload());
	act(() => frames.shift()!(0));
	expect(ctx.drawImage).toHaveBeenCalledWith(images[0], expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
	act(() => images[0].onerror());
	fireEvent.click(screen.getByRole("button", { name: "Retry logo" }));
	await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ refresh: true })));
});
it("pauses and resumes playback and preserves the canvas when drawing fails", async () => {
	const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(),
		pause = jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
	render(<Canvas creatorId='owner' clip={clip} layout={createClipComposition("desktop")} selected='gameplay' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	const video = await ready();
	fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
	expect(play).toHaveBeenCalled();
	fireEvent.play(video);
	Object.defineProperty(video, "paused", { configurable: true, value: false });
	fireEvent.click(screen.getByRole("button", { name: "Pause preview" }));
	expect(pause).toHaveBeenCalled();
	fireEvent.pause(video);
	expect(screen.getByRole("button", { name: "Play preview" })).toBeVisible();
	ctx.drawImage.mockImplementationOnce(() => {
		throw Error("canvas unavailable");
	});
	act(() => frames.shift()!(0));
	expect(screen.getByRole("button", { name: "Retry preview" })).toBeVisible();
	expect(document.querySelector("canvas")).toBeInTheDocument();
	expect(ctx.restore).toHaveBeenCalledTimes(ctx.save.mock.calls.length);
});
it("ignores a preview response after its editor has unmounted", async () => {
	let resolve!: (value: any) => void;
	preview.mockReturnValue(
		new Promise((r) => {
			resolve = r;
		}),
	);
	const view = render(<Canvas creatorId='owner' clip={clip} layout={createClipComposition("mobile")} selected='camera' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	view.unmount();
	await act(async () => resolve({ playbackUrl: "https://media.invalid/late.mp4" }));
	expect(document.querySelector("video")).not.toBeInTheDocument();
});
