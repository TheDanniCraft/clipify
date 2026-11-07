import { compositionGraph } from "./clip-composition-graph";
import "server-only";
import sharp from "sharp";
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
export async function compositionFilterGraph(layout: ClipComposition, clip: Parameters<typeof clipLayerText>[1], signal: AbortSignal, avatar?: string, brand?: CreatorBrand) {
	return compositionGraph(layout, await compositionAssets(layout, clip, signal, avatar, brand));
}
