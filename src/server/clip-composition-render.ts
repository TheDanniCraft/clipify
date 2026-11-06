import "server-only";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compositionWidgetTheme, compositionRectPixels, compositionDimensions, type ClipComposition } from "@/app/lib/clipComposition";
import { clipLayerText } from "@/app/lib/clipLayout";
import { type CreatorBrand } from "@/app/lib/overlayMetadata";
import { renderBrandWidget } from "./brand-font-render";
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
export async function compositionAssets(layout: ClipComposition, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, avatar?: string, brand?: CreatorBrand) {
	const { width, height } = compositionDimensions(layout.format);
	const logos = layout.layers.filter((layer) => layer.kind === "logo");
	let avatarImage: Buffer | undefined;
	if (avatar && layout.layers.some((layer) => layer.kind === "channel" || layer.kind === "logo"))
		avatarImage = await readClipCompositionLogo(avatar, signal).catch((error) => {
			if (logos.length || signal.aborted) throw error;
			return undefined;
		});
	const assets: Record<string, Buffer> = {};
	for (const layer of layout.layers) {
		if (layer.kind === "video") continue;
		const { w, h } = compositionRectPixels(layer.frame, width, height);
		assets[layer.id] = layer.kind === "logo" ? (avatarImage ?? (await readClipCompositionLogo(avatar, signal))) : await renderBrandWidget(layer.kind, clip, w, h, layer.fontSize, compositionWidgetTheme(layout, layer, brand), signal, avatarImage ? `data:image/png;base64,${avatarImage.toString("base64")}` : undefined);
	}
	return assets;
}
export async function compositionFilterGraph(layout: ClipComposition, dir: string, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, avatar?: string, brand?: CreatorBrand) {
	const { width, height } = compositionDimensions(layout.format),
		videos = layout.layers.filter((layer) => layer.kind === "video"),
		logos = layout.layers.filter((layer) => layer.kind === "logo");
	const filters: string[] = [],
		inputs: string[] = [];
	const assets = await compositionAssets(layout, clip, signal, avatar, brand);
	let inputIndex = 1;
	if (logos.length) {
		const path = join(dir, "channel-logo");
		await writeFile(path, assets[logos[0].id]);
		inputs.push("-loop", "1", "-max_pixels", "1000000", "-threads", "1", "-i", path);
		filters.push(`[${inputIndex++}:v]format=rgba,split=${logos.length}${logos.map((_, index) => `[logo${index}]`).join("")}`);
	}
	filters.push(`[0:v]split=${videos.length + 1}[background]${videos.map((_, index) => `[video${index}]`).join("")}`);
	filters.push(`[background]scale=${width}:${height},format=rgba,drawbox=color=black:t=fill[base]`);
	let previous = "base",
		videoIndex = 0,
		logoIndex = 0;
	for (const [index, layer] of layout.layers.entries()) {
		const { w, h, x, y } = compositionRectPixels(layer.frame, width, height);
		const label = `layer${index}`;
		if (layer.kind === "video") {
			const c = layer.source;
			filters.push(`[video${videoIndex++}]crop=w='max(2,trunc(iw*${c.w}/2)*2)':h='max(2,trunc(ih*${c.h}/2)*2)':x='trunc(iw*${c.x}/2)*2':y='trunc(ih*${c.y}/2)*2',scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=rgba,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1[${label}]`);
		} else if (layer.kind === "logo") {
			filters.push(`[logo${logoIndex++}]scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1[${label}]`);
		} else {
			const path = join(dir, `widget-${index}.png`);
			await writeFile(path, assets[layer.id]);
			inputs.push("-loop", "1", "-max_pixels", "1000000", "-threads", "1", "-i", path);
			filters.push(`[${inputIndex++}:v]format=rgba[${label}]`);
		}
		const output = `composite${index}`;
		filters.push(`[${previous}][${label}]overlay=x=${x}:y=${y}:shortest=1:eof_action=repeat[${output}]`);
		previous = output;
	}
	return { filters, output: previous, inputs };
}
