jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import Canvas from "@components/creator/clipCompositionCanvas";
import { createClipComposition } from "@lib/clipComposition";
const preview = jest.fn();
const boxes: any[] = [];
const rasterImages: any[] = [];
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...a: unknown[]) => preview(...a) }));
jest.mock("@components/creator/clipCompositionBox", () => ({
	__esModule: true,
	default: (props: any) => {
		boxes.push(props);
		const { label, onSelect, onChange, rect } = props;
		return (
			<button
				aria-label={label}
				onClick={() => {
					onSelect();
					onChange({ ...rect, x: 0.01 });
				}}
			/>
		);
	},
}));
let frames: FrameRequestCallback[] = [];
const ctx = { fillRect: jest.fn(), drawImage: jest.fn(), save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(), rect: jest.fn(), clip: jest.fn(), measureText: jest.fn(() => ({ width: 60 })), fillText: jest.fn() };
const clip = { id: "ClipA", title: "A moment", broadcasterName: "Channel", clipCreatorName: "Maker" };
beforeEach(() => {
	rasterImages.length = 0;
	jest.spyOn(window, "Image").mockImplementation(() => {
		const image = { width: 100, height: 100, src: "", onload: null, onerror: null };
		rasterImages.push(image);
		return image as never;
	});
	jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=");
	jest.clearAllMocks();
	frames = [];
	boxes.length = 0;
	preview.mockResolvedValue({ playbackUrl: "https://production.assets.clips.twitchcdn.net/source.mp4" });
	jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
		frames.push(cb);
		return frames.length;
	});
	jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
	jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
});
afterEach(() => jest.restoreAllMocks());
async function ready() {
	await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", expect.stringMatching(/^\/api\/clips\/preview\?creatorId=owner&clipId=ClipA&attempt=\d+$/)));
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
	const widget = rasterImages.find((image) => image.src.startsWith("data:image/svg+xml"));
	expect(decodeURIComponent(widget.src)).toContain("A moment");
	expect(decodeURIComponent(widget.src)).toContain("clipped by Maker");
	act(() => widget.onload());
	act(() => frames.shift()!(0));
	expect(ctx.drawImage).toHaveBeenCalledWith(widget, 0, 0, 720, 128);
	expect(dimensions).toHaveBeenCalledWith({ width: 1920, height: 1080 });
	fireEvent.click(screen.getByRole("button", { name: "Camera crop" }));
	expect(change).toHaveBeenCalled();
	expect(select).toHaveBeenCalledWith("camera", "source");
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
	layout.layers.push({ id: "channel", kind: "channel", label: "Channel badge", fontSize: 24, frame: { x: 0.1, y: 0.6, w: 0.75, h: 0.18 } });
	render(<Canvas creatorId='owner' clip={clip} layout={layout} selected='logo' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	await ready();
	expect(images[0].src).toContain("/api/clips/layout-logo?creatorId=owner");
	act(() => frames.shift()!(0));
	expect(decodeURIComponent(images.find((image) => image.src.startsWith("data:image/svg+xml")).src)).toContain("twitch.tv/channel");
	act(() => images[0].onload());
	act(() => frames.shift()!(0));
	expect(ctx.drawImage).toHaveBeenCalledWith(images[0], expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
	expect(images.some((image) => decodeURIComponent(image.src).includes("Channel"))).toBe(true);
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
it("applies output edits, source ratio modifiers and snapping guides independently", async () => {
	const layout = createClipComposition("mobile"),
		change = jest.fn();
	render(<Canvas creatorId='owner' clip={clip} layout={layout} selected='camera' onSelect={() => {}} onChange={change} onDimensions={() => {}} />);
	await ready();
	const source = boxes.find((p) => p.label === "Camera crop"),
		output = boxes.find((p) => p.label === "Camera output");
	const ratio = (output.rect.w * 720 * 1080) / (output.rect.h * 1280 * 1920);
	for (const keys of [{}, { shiftKey: true }, { ctrlKey: true }, { metaKey: true, shiftKey: true }]) expect(source.ratio(keys, source.rect)).toBeCloseTo(ratio);
	expect(output.ratio({}, output.rect)).toBeUndefined();
	expect(output.ratio({ shiftKey: true }, output.rect)).toBeCloseTo(output.rect.w / output.rect.h);
	expect(source.snap).toBe(true);
	act(() => {
		output.onSelect();
		output.onChange({ ...output.rect, x: 0.1 });
		output.onGuides({ x: 0.5, y: 0.5 });
		source.onGuides({ x: 0.5, y: 0.5 });
	});
	expect(change.mock.calls.at(-1)[0].layers[0]).toMatchObject({ source: layout.layers[0].kind === "video" ? layout.layers[0].source : {}, frame: { x: 0.1 } });
	expect(document.querySelector('[style="left: 50%;"]')).toBeInTheDocument();
});
it("handles unavailable playback and rejected playback attempts without removing the editable canvas", async () => {
	preview.mockResolvedValueOnce(null);
	const view = render(<Canvas creatorId='owner' clip={clip} layout={createClipComposition("desktop")} selected='gameplay' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
	const video = await ready();
	jest.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(Error("blocked"));
	fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
	await screen.findByRole("button", { name: "Retry preview" });
	video.currentTime = 3;
	fireEvent.timeUpdate(video);
	expect(screen.getByText("3 / 12s")).toBeVisible();
	view.unmount();
});

it("recovers a failed widget decode and ignores stale callbacks after removal", async () => {
	const layout = createClipComposition("desktop");
	layout.layers.push({ id: "title", label: "Clip info", kind: "title", fontSize: 32, frame: { x: 0, y: 0.8, w: 1, h: 0.2 } });
	const props = { creatorId: "owner", clip, selected: "title", onSelect: () => {}, onChange: () => {}, onDimensions: () => {} };
	const view = render(<Canvas {...props} layout={layout} />);
	await ready();
	act(() => frames.shift()!(0));
	const first = rasterImages.find((image) => image.src.startsWith("data:image/svg+xml"));
	act(() => first.onerror());
	expect(screen.getByRole("button", { name: "Retry preview" })).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await ready();
	act(() => frames.shift()!(0));
	const second = rasterImages.filter((image) => image.src.startsWith("data:image/svg+xml")).at(-1);
	expect(second).not.toBe(first);
	view.rerender(<Canvas {...props} layout={{ ...layout, layers: layout.layers.slice(0, 1) }} />);
	act(() => second.onerror());
	act(() => second.onload());
	expect(screen.queryByRole("button", { name: "Retry preview" })).not.toBeInTheDocument();
});

it("uses the same native font raster for a branded canvas without reloading its video", async () => {
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const layout = createClipComposition("mobile");
	layout.layers.push({ id: "title", label: "Clip info", kind: "title", fontSize: 32, frame: { x: 0, y: 0.8, w: 1, h: 0.1 } });
	const props = { creatorId: "owner", clip, layout, brand: creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), selected: "camera", onSelect: () => {}, onChange: () => {}, onDimensions: () => {} };
	render(<Canvas {...props} />);
	await ready();
	act(() => frames.shift()!(0));
	await waitFor(() => expect(rasterImages.some((image) => image.src.startsWith("/api/clips/widget-preview?data=") && decodeURIComponent(image.src).includes('"Laila"'))).toBe(true));
	expect(preview).toHaveBeenCalledTimes(1);
});
it("offers font retry in a toast without discarding the video preview", async () => {
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const { notify } = await import("@lib/toast");
	const layout = createClipComposition("mobile");
	layout.layers.push({ id: "title", kind: "title", label: "Clip info", fontSize: 32, frame: { x: 0, y: 0.8, w: 1, h: 0.1 } });
	render(<Canvas creatorId='owner' clip={clip} layout={layout} brand={creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" })} selected='camera' onSelect={() => {}} onChange={() => {}} onDimensions={() => {}} />);
	await ready();
	act(() => frames.shift()!(0));
	await waitFor(() => expect(rasterImages.some((image) => image.src.startsWith("/api/clips/widget-preview"))).toBe(true));
	const image = rasterImages.find((image) => image.src.startsWith("/api/clips/widget-preview"));
	act(() => image.onerror());
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Font preview unavailable" }));
	act(() => image.onerror());
	expect(notify).toHaveBeenCalledTimes(1);
	render(jest.mocked(notify).mock.calls[0][0].description as React.ReactElement);
	fireEvent.click(screen.getByRole("button", { name: "Retry widgets" }));
	act(() => frames.shift()!(0));
	await waitFor(() => expect(rasterImages.filter((image) => image.src.startsWith("/api/clips/widget-preview")).length).toBe(2));
	expect(preview).toHaveBeenCalledTimes(1);

	expect(screen.getByRole("button", { name: "Play preview" })).toBeEnabled();
});
it.each([false, true])("uses native raster fonts for built-in branding and queues previews without racing slots (remove=%s)", async (remove) => {
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const layout = createClipComposition("desktop");
	for (let i = 0; i < 3; i++) layout.layers.push({ id: `text-${i}`, kind: "title", label: `Info ${i}`, fontSize: 32, frame: { x: 0, y: i * 0.15, w: 0.5, h: 0.1 } });
	const props = { creatorId: "owner", clip, layout, brand: creatorBrandSchema.parse({ fontFamily: "DejaVu Serif" }), selected: "gameplay", onSelect: () => {}, onChange: () => {}, onDimensions: () => {} };
	const view = render(<Canvas {...props} />);
	await ready();
	act(() => frames.shift()!(0));
	const requests = () => rasterImages.filter((image) => image.src.startsWith("/api/clips/widget-preview"));
	await waitFor(() => expect(requests()).toHaveLength(1));
	if (remove) view.rerender(<Canvas {...props} layout={{ ...layout, layers: layout.layers.filter((layer) => layer.id !== "text-1") }} />);
	act(() => requests()[0].onload());
	await waitFor(() => expect(requests()).toHaveLength(2));
	if (!remove) {
		act(() => requests()[1].onload());
		await waitFor(() => expect(requests()).toHaveLength(3));
	}
	const last = requests().at(-1);
	view.unmount();
	act(() => last.onload());
	expect(preview).toHaveBeenCalledTimes(1);
});

it("selects the fixed watermark without geometry controls and delegates keyboard removal", async () => {
	const select = jest.fn(),
		change = jest.fn(),
		remove = jest.fn();
	render(<Canvas creatorId='owner' clip={clip} layout={createClipComposition("mobile")} selected='clipify-watermark' watermark onSelect={select} onChange={change} onDimensions={() => {}} onRemoveWatermark={remove} />);
	await ready();
	const mark = screen.getByRole("button", { name: "Clipify Watermark output" });
	fireEvent.click(mark);
	expect(select).toHaveBeenCalledWith("clipify-watermark", "output");
	fireEvent.keyDown(mark, { key: "ArrowRight" });
	expect(change).not.toHaveBeenCalled();
	expect(screen.queryByRole("button", { name: /Resize Clipify Watermark/ })).not.toBeInTheDocument();
	fireEvent.keyDown(mark, { key: "Delete" });
	expect(remove).toHaveBeenCalledTimes(1);
});
