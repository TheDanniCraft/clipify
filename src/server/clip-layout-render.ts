import "server-only";
import { encodeForPreset, type ExportPreset, type ExportEncoding } from "@lib/clipExportPreset";
import sharp from "sharp";
import { Input, BufferSource, MP4, Output, BufferTarget, Mp4OutputFormat, Conversion } from "mediabunny";
import { clipifyWatermarkSvg, clipifyWatermarkExpression, clipifyWatermarkPositions, type CreatorBrand } from "@lib/overlayMetadata";
import { spawn } from "node:child_process";
import type { Writable } from "node:stream";
import { clipLayoutSchema, clipLayerText, type ClipLayout } from "@lib/clipLayout";
import { compositionSchema, compositionDimensions, convertLegacyClipLayout, type ClipComposition } from "@lib/clipComposition";
import { compositionFilterGraph } from "./clip-composition-render";
const LIMIT = 32 * 1024 * 1024;
let activeRenders = 0;
function streamable(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (let offset = 0; offset + 8 <= bytes.length;) {
		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		if (type === "moov") return true;
		if (type === "mdat") return false;
		const size = view.getUint32(offset);
		if (size < 8) return false;
		offset += size;
	}
	return false;
}
async function sourceForPipe(bytes: Uint8Array, signal: AbortSignal) {
	const input = new Input({ source: new BufferSource(bytes), formats: [MP4] });
	let args: string[] = [];
	try {
		const track = await input.getPrimaryVideoTrack();
		// Match WebCodecs' default for untagged sources; retain explicit metadata.
		if (track && !(await track.getColorSpace()).matrix) args = ["-colorspace", "bt709"];
		if (streamable(bytes)) return { bytes, args };
		const target = new BufferTarget(),
			output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
		const conversion = await Conversion.init({ input, output, tracks: "primary", copy: { mode: "forced" } });
		if (!conversion.isValid || conversion.discardedTracks.length) throw new Error("render_failed");
		const cancel = () => {
			void conversion.cancel();
		};
		signal.throwIfAborted();
		signal.addEventListener("abort", cancel, { once: true });
		try {
			await conversion.execute();
		} finally {
			signal.removeEventListener("abort", cancel);
		}
		if (!target.buffer || target.buffer.byteLength > LIMIT + 1048576) throw new Error("file_size_limit");
		return { bytes: new Uint8Array(target.buffer), args };
	} catch (error) {
		signal.throwIfAborted();
		if (error instanceof Error && error.message === "file_size_limit") throw error;
		return { bytes, args }; // FFmpeg retains validation/diagnostics for malformed or unsupported media.
	} finally {
		input.dispose();
	}
}
type RenderContext = { avatar?: string; brand?: CreatorBrand; watermark?: boolean; preset?: ExportPreset };
export async function renderClipLayout(bytes: Uint8Array, layout: ClipLayout | ClipComposition, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, context?: RenderContext) {
	if (!context?.preset) return renderClipLayoutOnce(bytes, layout, clip, signal, context);
	signal.throwIfAborted();
	const input = new Input({ source: new BufferSource(bytes), formats: [MP4] });
	let duration: number;
	try {
		duration = await input.computeDuration();
	} finally {
		input.dispose();
	}
	return encodeForPreset(context.preset, duration, signal, (encoding) => renderClipLayoutOnce(bytes, layout, clip, signal, context, encoding));
}
/** All media travels through bounded pipes; no source, output or widget files are created. */
async function renderClipLayoutOnce(bytes: Uint8Array, layout: ClipLayout | ClipComposition, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, context?: RenderContext, encoding?: ExportEncoding) {
	const parsed = layout.version === 2 ? compositionSchema.parse(layout) : convertLegacyClipLayout(clipLayoutSchema.parse(layout));
	if (activeRenders >= 2) throw new Error("render_busy");
	signal.throwIfAborted();
	activeRenders++;
	try {
		const { filters, inputs, images, output } = await compositionFilterGraph(parsed, clip, signal, context?.avatar, context?.brand);
		let previous = output;
		if (context?.watermark) {
			const { width, height } = compositionDimensions(parsed.format);
			const positions = clipifyWatermarkPositions(
				width,
				height,
				parsed.layers.filter((layer) => layer.kind !== "video").map((layer) => layer.frame),
			);
			const index = 1 + images.length,
				fd = 3 + images.length;
			images.push(await sharp(Buffer.from(clipifyWatermarkSvg())).png().toBuffer());
			inputs.push("-f", "image2pipe", "-c:v", "png", "-max_pixels", "1000000", "-threads", "1", "-i", `pipe:${fd}`);
			filters.push(`[${index}:v]format=rgba,tpad=stop_mode=clone:stop=-1[mark]`, `[${previous}][mark]overlay=x='${clipifyWatermarkExpression(0, positions)}':y='${clipifyWatermarkExpression(1, positions)}':shortest=1:eof_action=repeat[branded]`);
			previous = "branded";
		}
		const source = await sourceForPipe(bytes, signal);
		signal.throwIfAborted();
		const args = [
			"-hide_banner",
			"-loglevel",
			"error",
			"-nostdin",
			"-protocol_whitelist",
			"pipe",
			"-threads",
			"1",
			...source.args,
			"-f",
			"mov",
			"-i",
			"pipe:0",
			...inputs,
			"-filter_complex_threads",
			"1",
			"-filter_complex",
			filters.join(";"),
			"-map",
			`[${previous}]`,
			"-map",
			"0:a?",
			"-c:v",
			"libx264",
			"-threads",
			"1",
			"-bf",
			"0",
			"-preset",
			"veryfast",
			...(encoding ? ["-b:v", String(encoding.videoBitrate), "-maxrate", String(encoding.videoBitrate), "-bufsize", String(encoding.videoBitrate * 2)] : ["-crf", "23"]),
			"-pix_fmt",
			"yuv420p",
			"-r",
			"30",
			"-c:a",
			"aac",
			"-b:a",
			String(encoding?.audioBitrate ?? 128000),
			...(encoding ? ["-ar", "48000", "-ac", "2"] : []),
			"-avoid_negative_ts",
			"disabled",
			"-movflags",
			"frag_keyframe+empty_moov+default_base_moof+negative_cts_offsets",
			"-f",
			"mp4",
			"pipe:1",
		];
		const chunks: Buffer[] = [];
		let length = 0;
		await new Promise<void>((resolve, reject) => {
			const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe", ...images.map(() => "pipe" as const)], signal, killSignal: "SIGKILL", timeout: 90000 });
			let stderr = "",
				oversized = false;
			child.stderr?.on("data", (chunk: Buffer) => {
				stderr = (stderr + chunk.toString()).slice(-4096);
			});
			child.stdout?.on("data", (chunk: Buffer) => {
				length += chunk.length;
				if (length >= Math.min(LIMIT, (encoding?.maxBytes ?? LIMIT - 1) + 1)) {
					oversized = true;
					child.kill("SIGKILL");
				} else chunks.push(chunk);
			});
			child.once("error", () => reject(new Error("render_failed")));
			child.once("close", (code, stopped) => {
				if (oversized) return reject(new Error("file_size_limit"));
				if (code === 0) return resolve();
				console.error("Clip render failed", { code, signal: stopped, stderr });
				reject(new Error("render_failed"));
			});
			for (const [index, data] of [source.bytes, ...images].entries()) {
				const pipe = (index === 0 ? child.stdin : child.stdio?.[index + 2]) as Writable | null;
				pipe?.on("error", () => {});
				pipe?.end(data);
			}
		});
		signal.throwIfAborted();
		if (length < 32) throw new Error("file_size_limit");
		return new Uint8Array(Buffer.concat(chunks, length));
	} finally {
		activeRenders--;
	}
}
