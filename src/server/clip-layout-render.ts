import "server-only";
import sharp from "sharp";
import { Input, BufferSource, MP4 } from "mediabunny";
import { clipifyWatermarkSvg, clipifyWatermarkExpression, clipifyWatermarkPositions, type CreatorBrand } from "@lib/overlayMetadata";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clipLayoutSchema, clipLayerText, clipLayerLines, type ClipLayout } from "@lib/clipLayout";
import { compositionSchema, compositionDimensions, type ClipComposition } from "@lib/clipComposition";
import { compositionFilterGraph } from "./clip-composition-render";
async function inputColorArgs(bytes: Uint8Array) {
	const input = new Input({ source: new BufferSource(bytes), formats: [MP4] });
	try {
		const track = await input.getPrimaryVideoTrack();
		// Match WebCodecs' default for untagged sources; retain explicit source metadata.
		return track && !(await track.getColorSpace()).matrix ? ["-colorspace", "bt709"] : [];
	} catch {
		return []; // FFmpeg validates malformed media and reports the existing typed failure.
	} finally {
		input.dispose();
	}
}
let activeRenders = 0;
const LIMIT = 32 * 1024 * 1024;
/** FFmpeg receives only bounded local files, never user URLs or shell command strings. */
export async function renderClipLayout(bytes: Uint8Array, layout: ClipLayout | ClipComposition, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, context?: { avatar?: string; brand?: CreatorBrand; watermark?: boolean }) {
	const parsed = layout.version === 2 ? compositionSchema.parse(layout) : clipLayoutSchema.parse(layout);
	if (activeRenders >= 2) throw new Error("render_busy");
	signal.throwIfAborted();
	activeRenders++;
	let dir: string | undefined;
	try {
		dir = await mkdtemp(join(tmpdir(), "clipify-render-"));
		const input = join(dir, "input.mp4"),
			output = join(dir, "output.mp4");
		await writeFile(input, bytes);
		const watermarkWidgets: { x: number; y: number; w: number; h: number }[] = [];
		let filters: string[],
			previous: string,
			inputs: string[] = [];
		if (parsed.version === 2) {
			watermarkWidgets.push(...parsed.layers.filter((layer) => layer.kind !== "video").map((layer) => layer.frame));
			const graph = await compositionFilterGraph(parsed, dir, clip, signal, context?.avatar, context?.brand);
			filters = graph.filters;
			previous = graph.output;
			inputs = graph.inputs;
		} else {
			const camH = Math.round((1280 * parsed.cameraShare) / 2) * 2;
			const crop = (c: ClipLayout["gameplay"], w: number, h: number) => `crop=w='max(2,trunc(iw*${c.w}/2)*2)':h='max(2,trunc(ih*${c.h}/2)*2)':x='trunc(iw*${c.x}/2)*2':y='trunc(ih*${c.y}/2)*2',scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
			filters = parsed.mode === "full" ? [`[0:v]${crop(parsed.gameplay, 720, 1280)}[composed]`] : [`[0:v]split=2[g][c]`, `[g]${crop(parsed.gameplay, 720, 1280 - camH)}[game]`, `[c]${crop(parsed.camera, 720, camH)}[cam]`, `[cam][game]vstack=inputs=2[composed]`];
			previous = "composed";
			for (const [index, layer] of parsed.textLayers.entries()) {
				const lines = clipLayerLines(clipLayerText(layer.field, clip), layer.size);
				const text = lines.join("\n");
				watermarkWidgets.push({ x: layer.x / 100, y: layer.y / 100, w: Math.min(1 - layer.x / 100, (Math.max(...lines.map((line) => line.length), 0) * layer.size + 12) / 720), h: Math.min(1 - layer.y / 100, (lines.length * layer.size * 1.2 + 12) / 1280) });
				await writeFile(join(dir, `text-${index}.txt`), text);
				// Text files and expansion=none keep provider titles out of FFmpeg filter syntax.
				filters.push(`[${previous}]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${dir}/text-${index}.txt:expansion=none:fontcolor=white:fontsize=${layer.size}:box=1:boxcolor=black@0.65:boxborderw=6:x='min(w-tw-8,w*${layer.x / 100})':y='min(h-th-8,h*${layer.y / 100})'[text${index}]`);
				previous = `text${index}`;
			}
		}
		if (context?.watermark) {
			const dimensions = parsed.version === 2 ? compositionDimensions(parsed.format) : { width: 720, height: 1280 };
			const positions = clipifyWatermarkPositions(dimensions.width, dimensions.height, watermarkWidgets);
			const path = join(dir, "clipify-watermark.png");
			await writeFile(path, await sharp(Buffer.from(clipifyWatermarkSvg())).png().toBuffer());
			const index = 1 + inputs.filter((value) => value === "-i").length;
			inputs.push("-loop", "1", "-max_pixels", "1000000", "-threads", "1", "-i", path);
			filters.push(`[${previous}][${index}:v]overlay=x='${clipifyWatermarkExpression(0, positions)}':y='${clipifyWatermarkExpression(1, positions)}':shortest=1:eof_action=repeat[branded]`);
			previous = "branded";
		}
		const args = [
			"-hide_banner",
			"-loglevel",
			"error",
			"-nostdin",
			"-protocol_whitelist",
			"file,pipe",
			"-threads",
			"1",
			...(await inputColorArgs(bytes)),
			"-f",
			"mov",
			"-i",
			input,
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
			"-preset",
			"veryfast",
			"-crf",
			"23",
			"-pix_fmt",
			"yuv420p",
			"-r",
			"30",
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			"-movflags",
			"+faststart",
			"-fs",
			String(LIMIT + 1024 * 1024),
			"-y",
			output,
		];
		await new Promise<void>((resolve, reject) => {
			const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"], signal, killSignal: "SIGKILL", timeout: 90000 });
			let stderr = "";
			child.stderr?.on("data", (chunk: Buffer) => {
				stderr = (stderr + chunk.toString()).slice(-4096);
			});
			child.once("error", () => reject(new Error("render_failed")));
			child.once("close", (code, signal) => {
				if (code === 0) return resolve();
				console.error("Clip render failed", { code, signal, stderr });
				reject(new Error("render_failed"));
			});
		});
		signal.throwIfAborted();
		const size = (await stat(output)).size;
		if (size >= LIMIT || size < 32) throw new Error("file_size_limit");
		return new Uint8Array(await readFile(output));
	} finally {
		try {
			if (dir) await rm(dir, { recursive: true, force: true });
		} finally {
			activeRenders--;
		}
	}
}
