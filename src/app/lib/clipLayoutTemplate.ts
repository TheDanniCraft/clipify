import { z } from "zod";
import { compositionSchema, createClipComposition, type ClipComposition } from "./clipComposition";
export const templateCompositionsSchema = z.object({ desktop: compositionSchema.refine((value) => value.format === "desktop"), mobile: compositionSchema.refine((value) => value.format === "mobile") });
export function templateCompositions(entry: { composition: ClipComposition; compositions?: z.infer<typeof templateCompositionsSchema> }) {
	return entry.compositions ?? { desktop: entry.composition.format === "desktop" ? entry.composition : createClipComposition("desktop"), mobile: entry.composition.format === "mobile" ? entry.composition : createClipComposition("mobile") };
}
export function compositionLayerColor(id: string) {
	if (id === "camera") return "#f472b6";
	if (id === "gameplay") return "#22d3ee";
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return `hsl(${Number(((hash * 137.508) % 360).toFixed(3))} 85% 65%)`;
}
