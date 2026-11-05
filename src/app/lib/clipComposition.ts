import { z } from "zod";
import { widgetThemeSchema } from "./overlayMetadata";
import { defaultClipLayout, sourceCrop, type ClipLayout } from "./clipLayout";
const rectSchema = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), w: z.number().finite().min(0.002).max(1), h: z.number().finite().min(0.002).max(1) }).refine((r) => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001, "Keep the box inside the frame.");
const frameSchema = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), w: z.number().finite().min(0.000001).max(1), h: z.number().finite().min(0.000001).max(1) }).refine((r) => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001, "Keep the layer inside the canvas.");
const base = { id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), label: z.string().trim().min(1).max(80), frame: frameSchema };
const text = { ...base, fontSize: z.number().int().min(12).max(96) };
export const compositionSchema = z.object({
	version: z.literal(2),
	format: z.enum(["desktop", "mobile"]),
	widgetTheme: widgetThemeSchema.optional(),
	layers: z
		.array(z.discriminatedUnion("kind", [z.object({ ...base, kind: z.literal("video"), source: rectSchema }), z.object({ ...text, kind: z.literal("title") }), z.object({ ...text, kind: z.literal("channel") }), z.object({ ...text, kind: z.literal("clipper") }), z.object({ ...base, kind: z.literal("logo") })]))
		.min(1)
		.max(32)
		.refine((layers) => new Set(layers.map((layer) => layer.id)).size === layers.length, "Every layer needs a unique ID."),
});
export type ClipComposition = z.infer<typeof compositionSchema>;
export type CompositionLayer = ClipComposition["layers"][number];
export type CompositionRect = CompositionLayer["frame"];
const clean = (n: number) => Number(n.toFixed(6));
export function resizeCompositionRect(rect: CompositionRect, dx: number, dy: number, corner: "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se", ratio?: number): CompositionRect {
	const west = corner.includes("w"),
		north = corner.includes("n"),
		horizontal = corner.includes("w") || corner.includes("e"),
		vertical = corner.includes("n") || corner.includes("s");
	const ax = west ? rect.x + rect.w : horizontal ? rect.x : rect.x + rect.w / 2,
		ay = north ? rect.y + rect.h : vertical ? rect.y : rect.y + rect.h / 2;
	const maxW = horizontal ? (west ? ax : 1 - ax) : 2 * Math.min(ax, 1 - ax),
		maxH = vertical ? (north ? ay : 1 - ay) : 2 * Math.min(ay, 1 - ay);
	let w = Math.max(0.002, rect.w + (horizontal ? (west ? -dx : dx) : 0)),
		h = Math.max(0.002, rect.h + (vertical ? (north ? -dy : dy) : 0));
	if (ratio && Number.isFinite(ratio) && ratio > 0) {
		if (!vertical || (horizontal && Math.abs(dx / rect.w) > Math.abs(dy / rect.h))) h = w / ratio;
		else w = h * ratio;
		w = Math.max(w, 0.002, 0.002 * ratio);
		h = w / ratio;
		const scale = Math.min(1, maxW / w, maxH / h);
		w *= scale;
		h *= scale;
	} else {
		w = Math.min(w, maxW);
		h = Math.min(h, maxH);
	}
	return { x: clean(west ? ax - w : horizontal ? ax : ax - w / 2), y: clean(north ? ay - h : vertical ? ay : ay - h / 2), w: clean(w), h: clean(h) };
}
export function snapCompositionRect(rect: CompositionRect, others: CompositionRect[], thresholdX: number, thresholdY: number) {
	const guides: { x?: number; y?: number } = {};
	const next = { ...rect };
	for (const axis of ["x", "y"] as const) {
		const size = axis === "x" ? "w" : "h",
			threshold = axis === "x" ? thresholdX : thresholdY;
		const targets = [0, 0.5, 1, ...others.flatMap((r) => [r[axis], r[axis] + r[size] / 2, r[axis] + r[size]])];
		let closest = threshold + Number.EPSILON,
			offset = 0;
		for (const target of targets)
			for (const edge of [rect[axis], rect[axis] + rect[size] / 2, rect[axis] + rect[size]]) {
				const delta = target - edge;
				if (Math.abs(delta) < closest && rect[axis] + delta >= -0.000001 && rect[axis] + delta + rect[size] <= 1.000001) {
					closest = Math.abs(delta);
					offset = delta;
					guides[axis] = clean(target);
				}
			}
		next[axis] = clean(Math.max(0, Math.min(1 - rect[size], rect[axis] + offset)));
	}
	return { rect: next, guides };
}

export function compositionDimensions(format: ClipComposition["format"]) {
	return format === "desktop" ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
}
export function convertLegacyClipLayout(layout: ClipLayout): ClipComposition {
	const cameraHeight = Math.round((1280 * layout.cameraShare) / 2) * 2;
	const video = (id: "gameplay" | "camera", y: number, height: number): CompositionLayer => {
		const crop = sourceCrop(layout[id], 1920, 1080, 720, height);
		return { id, kind: "video", label: id === "gameplay" ? "Gameplay" : "Camera", source: { x: crop.x / 1920, y: crop.y / 1080, w: crop.w / 1920, h: crop.h / 1080 }, frame: { x: 0, y: y / 1280, w: 1, h: height / 1280 } };
	};
	const layers: CompositionLayer[] = layout.mode === "full" ? [video("gameplay", 0, 1280)] : [video("camera", 0, cameraHeight), video("gameplay", cameraHeight, 1280 - cameraHeight)];
	for (const layer of layout.textLayers) layers.push({ id: `text-${layer.field}`, kind: layer.field, label: layer.field === "title" ? "Clip title" : layer.field === "channel" ? "Channel name" : "Clipper", fontSize: layer.size, frame: { x: layer.x / 100, y: layer.y / 100, w: Math.min(680 / 720, 1 - layer.x / 100), h: Math.min(0.15, 1 - layer.y / 100) } });
	return { version: 2, format: "mobile", layers };
}
export function createClipComposition(format: ClipComposition["format"]): ClipComposition {
	return format === "mobile" ? convertLegacyClipLayout(defaultClipLayout) : { version: 2, format, layers: [{ id: "gameplay", kind: "video", label: "Gameplay", source: { x: 0, y: 0, w: 1, h: 1 }, frame: { x: 0, y: 0, w: 1, h: 1 } }] };
}
export function updateCompositionSource(layout: ClipComposition, id: string, source: CompositionRect, dimensions: { width: number; height: number }): ClipComposition {
	return { ...layout, layers: layout.layers.map((layer) => (layer.id === id && layer.kind === "video" ? { ...layer, source: cropForFrame(source, layer.frame, dimensions, compositionDimensions(layout.format)) } : layer)) };
}
export function cropForFrame(source: CompositionRect, frame: CompositionRect, dimensions: { width: number; height: number }, output: { width: number; height: number }): CompositionRect {
	const ratio = Math.max(0.002, Math.min(500, (frame.w * output.width * dimensions.height) / (frame.h * output.height * dimensions.width)));
	const cx = source.x + source.w / 2,
		cy = source.y + source.h / 2;
	const w = Math.min(1, ratio, Math.max(0.002, 0.002 * ratio, Math.min(source.w, source.h * ratio))),
		h = w / ratio;
	return { x: clean(Math.max(0, Math.min(1 - w, cx - w / 2))), y: clean(Math.max(0, Math.min(1 - h, cy - h / 2))), w: clean(w), h: clean(h) };
}
export function updateCompositionFrame(layout: ClipComposition, id: string, frame: CompositionRect, dimensions: { width: number; height: number }): ClipComposition {
	return { ...layout, layers: layout.layers.map((layer) => (layer.id !== id ? layer : layer.kind === "video" ? { ...layer, frame, source: Math.abs(layer.frame.w / layer.frame.h - frame.w / frame.h) < 0.00001 ? layer.source : cropForFrame(layer.source, frame, dimensions, compositionDimensions(layout.format)) } : { ...layer, frame })) };
}
