import { compositionDimensions, compositionRectPixels, type ClipComposition } from "@lib/clipComposition";
// Keep native reference rendering available to tests without exposing a server video-render endpoint.
export function compositionGraph(layout: ClipComposition, assets: Record<string, Buffer>) {
	const { width, height } = compositionDimensions(layout.format),
		videos = layout.layers.filter((layer) => layer.kind === "video"),
		logos = layout.layers.filter((layer) => layer.kind === "logo");
	const filters: string[] = [],
		inputs: string[] = [];
	const images: Buffer[] = [];
	const imageInput = (bytes: Buffer) => {
		const fd = 3 + images.length;
		images.push(bytes);
		inputs.push("-f", "image2pipe", "-c:v", "png", "-max_pixels", "1000000", "-threads", "1", "-i", `pipe:${fd}`);
	};
	let inputIndex = 1;
	if (logos.length) {
		imageInput(assets[logos[0].id]);
		filters.push(`[${inputIndex++}:v]format=rgba,tpad=stop_mode=clone:stop=-1,split=${logos.length}${logos.map((_, index) => `[logo${index}]`).join("")}`);
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
			imageInput(assets[layer.id]);
			filters.push(`[${inputIndex++}:v]format=rgba,tpad=stop_mode=clone:stop=-1[${label}]`);
		}
		const output = `composite${index}`;
		filters.push(`[${previous}][${label}]overlay=x=${x}:y=${y}:shortest=1:eof_action=repeat[${output}]`);
		previous = output;
	}
	return { filters, output: previous, inputs, images };
}
