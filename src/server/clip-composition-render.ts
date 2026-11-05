import "server-only";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compositionDimensions, type ClipComposition } from "@/app/lib/clipComposition";
import { clipLayerText, clipLayerLines } from "@/app/lib/clipLayout";
import { readBoundedResponse } from "@/app/lib/clipExport";
const avatarHosts = new Set(["static-cdn.jtvnw.net", "lh3.googleusercontent.com", "yt3.googleusercontent.com", "yt3.ggpht.com"]);
export async function readClipCompositionLogo(avatar: string | undefined, signal: AbortSignal) {
	if (!avatar) throw new Error("render_failed");
	const url = new URL(avatar);
	if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !avatarHosts.has(url.hostname)) throw new Error("render_failed");
	const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), redirect: "manual", cache: "no-store" });
	if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(response.headers.get("content-type")?.split(";")[0] ?? "")) {
		await response.body?.cancel();
		throw new Error("render_failed");
	}
	const bytes = await readBoundedResponse(response, 2 * 1024 * 1024, signal);
	const png = bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
	const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	const webp = bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
	if (!png && !jpeg && !webp) throw new Error("render_failed");
	return sharp(bytes, { limitInputPixels: 1000000, animated: false }).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}
export async function compositionFilterGraph(layout: ClipComposition, dir: string, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, avatar?: string) {
	const { width, height } = compositionDimensions(layout.format),
		videos = layout.layers.filter((layer) => layer.kind === "video"),
		logos = layout.layers.filter((layer) => layer.kind === "logo" || layer.kind === "channel");
	const filters: string[] = [],
		inputs: string[] = [];
	if (logos.length) {
		const path = join(dir, "channel-logo");
		const image =
			avatar || logos.some((layer) => layer.kind === "logo")
				? await readClipCompositionLogo(avatar, signal)
				: await sharp({ create: { width: 64, height: 64, channels: 4, background: "#71717a" } })
						.png()
						.toBuffer();
		await writeFile(path, image);
		inputs.push("-loop", "1", "-max_pixels", "1000000", "-i", path);
		filters.push(`[1:v]format=rgba,split=${logos.length}${logos.map((_, index) => `[logo${index}]`).join("")}`);
	}
	filters.push(`[0:v]split=${videos.length + 1}[background]${videos.map((_, index) => `[video${index}]`).join("")}`);
	filters.push(`[background]scale=${width}:${height},format=rgba,drawbox=color=black:t=fill[base]`);
	let previous = "base",
		videoIndex = 0,
		logoIndex = 0;
	for (const [index, layer] of layout.layers.entries()) {
		const w = Math.max(2, Math.trunc((layer.frame.w * width) / 2) * 2),
			h = Math.max(2, Math.trunc((layer.frame.h * height) / 2) * 2),
			x = Math.trunc((layer.frame.x * width) / 2) * 2,
			y = Math.trunc((layer.frame.y * height) / 2) * 2;
		const label = `layer${index}`;
		if (layer.kind === "video") {
			const c = layer.source;
			filters.push(`[video${videoIndex++}]crop=w='max(2,trunc(iw*${c.w}/2)*2)':h='max(2,trunc(ih*${c.h}/2)*2)':x='trunc(iw*${c.x}/2)*2':y='trunc(ih*${c.y}/2)*2',scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=rgba,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1[${label}]`);
		} else if (layer.kind === "logo") {
			filters.push(`[logo${logoIndex++}]scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1[${label}]`);
		} else if (layer.kind === "channel") {
			const padding = Math.min(12, h / 8),
				side = Math.max(2, Math.trunc((h - padding * 2) / 2) * 2);
			const path = join(dir, `widget-${index}.txt`);
			await writeFile(path, clipLayerLines(clipLayerText("channel", clip), layer.fontSize, Math.max(1, w - side - padding * 3))[0] ?? "");
			filters.push(`color=c=0x18181b@0.95:s=${w}x${h}:r=30,format=rgba[badge${index}]`);
			filters.push(`[logo${logoIndex++}]scale=${side}:${side},setsar=1[avatar${index}]`);
			filters.push(`[badge${index}][avatar${index}]overlay=x=${padding}:y=${padding}:shortest=1,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${path}:expansion=none:fontcolor=white:fontsize=${layer.fontSize}:x=${side + padding * 2}:y=(h-text_h)/2[${label}]`);
		} else {
			const path = join(dir, `widget-${index}.txt`),
				padding = Math.min(12, h / 8),
				text = clipLayerLines(clipLayerText(layer.kind, clip), layer.fontSize, Math.max(1, w - padding * 2)).join("\n");
			await writeFile(path, text);
			filters.push(`color=c=0x18181b@0.95:s=${w}x${h}:r=30,format=rgba,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${path}:expansion=none:fontcolor=white:fontsize=${layer.fontSize}:x=${padding}:y=${padding}:line_spacing=${Math.round(layer.fontSize * 0.2)}[${label}]`);
		}
		const output = `composite${index}`;
		filters.push(`[${previous}][${label}]overlay=x=${x}:y=${y}:shortest=1:eof_action=repeat[${output}]`);
		previous = output;
	}
	return { filters, output: previous, inputs };
}
