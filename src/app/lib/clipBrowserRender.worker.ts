import { Input, BufferSource, MP4, Output, Mp4OutputFormat, StreamTarget, Conversion, Quality } from "mediabunny";
import { compositionDimensions, compositionRectPixels } from "./clipComposition";
import { CLIPIFY_WATERMARK, clipifyWatermarkPosition, clipifyWatermarkPositions } from "./overlayMetadata";
import { encodeForPreset, type ExportEncoding } from "./clipExportPreset";
import type { BrowserOutput } from "./clipBrowserExport";
const port = self as unknown as Pick<Worker, "postMessage" | "onmessage">;
const LIMIT = 32 * 1024 * 1024;
async function bitmap(uri: string) {
	const binary = atob(uri.slice(uri.indexOf(",") + 1));
	return createImageBitmap(new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], { type: "image/png" }));
}
async function probe() {
	if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined" || typeof OffscreenCanvas === "undefined") return "unsupported";
	const started = performance.now();
	for (const [width, height] of [
		[1280, 720],
		[720, 1280],
	]) {
		const config = { codec: "avc1.42001f", width, height, bitrate: 4000000, framerate: 30 };
		if (!(await VideoEncoder.isConfigSupported(config)).supported) return "unsupported";
		let failed = false;
		const encoder = new VideoEncoder({
			output: () => {},
			error: () => {
				failed = true;
			},
		});
		try {
			encoder.configure(config);
			const canvas = new OffscreenCanvas(width, height);
			const context = canvas.getContext("2d");
			if (!context) return "unsupported";
			context.fillRect(0, 0, width, height);
			for (let i = 0; i < 3; i++) {
				const frame = new VideoFrame(canvas, { timestamp: i * 33333 });
				encoder.encode(frame);
				frame.close();
			}
			await encoder.flush();
		} finally {
			encoder.close();
		}
		if (failed) return "unsupported";
	}
	return performance.now() - started > 2000 ? "slow" : "supported";
}
async function render(bytes: ArrayBuffer, recipe: BrowserOutput) {
	if (!recipe.preset) return renderOnce(bytes, recipe);
	const input = new Input({ source: new BufferSource(bytes), formats: [MP4] });
	let duration: number,
		audioBitrate = 0;
	try {
		duration = await input.computeDuration();
		const audio = await input.getPrimaryAudioTrack();
		if (audio) {
			if ((await audio.getCodec()) !== "aac") throw new Error("browser_unsupported");
			audioBitrate = (await audio.computePacketStats()).averageBitrate;
		}
	} finally {
		input.dispose();
	}
	// Copy compatible AAC instead of requiring an AAC encoder on the user's OS.
	const result = await encodeForPreset(recipe.preset, duration, new AbortController().signal, async (encoding) => new Uint8Array(await renderOnce(bytes, recipe, encoding)), audioBitrate);
	return result.buffer;
}
async function renderOnce(bytes: ArrayBuffer, recipe: BrowserOutput, encoding?: ExportEncoding) {
	if (!recipe.layout) throw new Error("browser_unsupported");
	const layout = recipe.layout,
		{ width, height } = compositionDimensions(layout.format),
		images = new Map<string, ImageBitmap>();
	const input = new Input({ source: new BufferSource(bytes), formats: [MP4] });
	try {
		for (const [id, uri] of Object.entries(recipe.assets)) images.set(id, await bitmap(uri));
		const mark = recipe.watermark ? await bitmap(recipe.watermark) : null;
		if (mark) images.set("__watermark", mark);
		const canvas = new OffscreenCanvas(width, height),
			ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("browser_unsupported");
		const storage = new Uint8Array(Math.min(LIMIT, encoding?.maxBytes ?? LIMIT));
		let size = 0;
		const target = new StreamTarget(
			new WritableStream({
				write(chunk) {
					const end = chunk.position + chunk.data.length;
					if (end > Math.min(LIMIT, encoding?.maxBytes ?? LIMIT)) throw new Error("file_size_limit");
					storage.set(chunk.data, chunk.position);
					size = Math.max(size, end);
				},
			}),
		);
		const output = new Output({ format: new Mp4OutputFormat({ fastStart: "reserve" }), target });
		const positions = clipifyWatermarkPositions(
			width,
			height,
			layout.layers.filter((l) => l.kind !== "video").map((l) => l.frame),
		);
		let first: number | undefined;
		const conversion = await Conversion.init({
			input,
			output,
			tracks: "primary",

			video: {
				codec: "avc",
				quality: new Quality({ bitrate: encoding?.videoBitrate ?? 4000000 }),
				frameRate: 30,
				forceTranscode: true,
				processedWidth: width,
				processedHeight: height,
				process(sample) {
					const frame = sample.toVideoFrame();
					first ??= sample.timestamp;
					try {
						ctx.fillStyle = "#000";
						ctx.fillRect(0, 0, width, height);
						for (const layer of layout.layers) {
							const { x, y, w, h } = compositionRectPixels(layer.frame, width, height);
							ctx.save();
							try {
								ctx.beginPath();
								ctx.rect(x, y, w, h);
								ctx.clip();
								if (layer.kind === "video") {
									const source = compositionRectPixels(layer.source, sample.displayWidth, sample.displayHeight);
									const scale = Math.min(w / source.w, h / source.h),
										dw = Math.max(2, Math.floor((source.w * scale) / 2) * 2),
										dh = Math.max(2, Math.floor((source.h * scale) / 2) * 2);
									ctx.drawImage(frame, source.x, source.y, source.w, source.h, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
								} else {
									const image = images.get(layer.id);
									if (!image) throw new Error("render_failed");
									if (layer.kind === "logo") {
										const scale = Math.min(w / image.width, h / image.height),
											dw = Math.max(2, Math.floor((image.width * scale) / 2) * 2),
											dh = Math.max(2, Math.floor((image.height * scale) / 2) * 2);
										ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
									} else ctx.drawImage(image, x, y, w, h);
								}
							} finally {
								ctx.restore();
							}
						}
						if (mark) {
							const position = clipifyWatermarkPosition(sample.timestamp - first, positions);
							ctx.drawImage(mark, position.x, position.y, CLIPIFY_WATERMARK.width, CLIPIFY_WATERMARK.height);
						}
						return canvas;
					} finally {
						frame.close();
					}
				},
			},
		});
		if (!conversion.isValid || conversion.discardedTracks.length) throw new Error("browser_unsupported");
		let previous = -1;
		conversion.onProgress = (value) => {
			const percent = Math.floor(value * 100);
			if (percent !== previous) {
				previous = percent;
				port.postMessage({ type: "progress", value: percent });
			}
		};
		await conversion.execute();
		return storage.slice(0, size).buffer;
	} finally {
		input.dispose();
		for (const image of images.values()) image.close();
	}
}
port.onmessage = async (event: MessageEvent) => {
	try {
		if (event.data.type === "probe") {
			port.postMessage({ type: "capability", value: await probe() });
			return;
		}
		const bytes = await render(event.data.bytes, event.data.output);
		port.postMessage({ type: "result", bytes }, [bytes]);
	} catch (error) {
		port.postMessage({ type: "error", code: error instanceof Error && ["file_size_limit", "preset_size_limit"].includes(error.message) ? error.message : "browser_unsupported" });
	}
};
