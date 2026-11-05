import { z } from "zod";
const cropSchema = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), w: z.number().finite().min(0.02).max(1), h: z.number().finite().min(0.02).max(1) }).refine((c) => c.x + c.w <= 1.000001 && c.y + c.h <= 1.000001, "Keep the crop inside the original clip.");
export const clipLayoutSchema = z.object({ version: z.literal(1), mode: z.enum(["full", "stacked"]), cameraShare: z.number().finite().min(0.2).max(0.5), gameplay: cropSchema, camera: cropSchema, textLayers: z.array(z.object({ field: z.enum(["title", "channel", "clipper"]), x: z.number().finite().min(0).max(85), y: z.number().finite().min(0).max(90), size: z.number().int().min(16).max(48) })).max(3) });
export type ClipLayout = z.infer<typeof clipLayoutSchema>;
export type ClipCrop = ClipLayout["gameplay"];
export const defaultClipLayout: ClipLayout = { version: 1, mode: "stacked", cameraShare: 1 / 3, gameplay: { x: 0, y: 0, w: 1, h: 1 }, camera: { x: 0.75, y: 0, w: 0.25, h: 0.3 }, textLayers: [] };
/** Match cover framing in the preview and the renderer without stretching the source. */
export function sourceCrop(c: ClipCrop, sw: number, sh: number, dw: number, dh: number) {
	let w = c.w * sw,
		h = c.h * sh;
	const ratio = dw / dh;
	if (w / h > ratio) w = h * ratio;
	else h = w / ratio;
	return { x: c.x * sw + (c.w * sw - w) / 2, y: c.y * sh + (c.h * sh - h) / 2, w, h };
}
export function clipLayerText(field: ClipLayout["textLayers"][number]["field"], clip: { title: string; broadcasterName?: string | null; clipCreatorName?: string | null }) {
	return (field === "title" ? clip.title : field === "channel" ? clip.broadcasterName : clip.clipCreatorName)?.replace(/[\r\n\t\u0000-\u001f]/g, " ").slice(0, 100) || "";
}

/** Use the same bounded multiline credits in the canvas and MP4. */
export function clipLayerLines(text: string, size: number) {
	const width = Math.max(1, Math.floor(680 / size));
	const characters = Array.from(text);
	const lines: string[] = [];
	while (characters.length && lines.length < 3) lines.push(characters.splice(0, width).join(""));
	if (characters.length) lines[2] = lines[2].slice(0, -1) + "…";
	return lines;
}
