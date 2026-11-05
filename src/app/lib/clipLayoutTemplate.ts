import { z } from "zod";
import { compositionSchema, createClipComposition, type ClipComposition } from "./clipComposition";
export const templateCompositionsSchema = z.object({ desktop: compositionSchema.refine((value) => value.format === "desktop"), mobile: compositionSchema.refine((value) => value.format === "mobile") });
export function templateCompositions(entry: { composition: ClipComposition; compositions?: z.infer<typeof templateCompositionsSchema> }) {
	return entry.compositions ?? { desktop: entry.composition.format === "desktop" ? entry.composition : createClipComposition("desktop"), mobile: entry.composition.format === "mobile" ? entry.composition : createClipComposition("mobile") };
}
export function compositionLayerColor(id: string, ids?: readonly string[]) {
	const palette = ["#f472b6", "#22d3ee", "#fbbf24", "#a78bfa", "#34d399", "#fb923c"];
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	const index = ids ? [...ids].sort().indexOf(id) : hash % palette.length;
	return palette[index] ?? `hsl(${(index * 137.508) % 360} 85% 65%)`;
}
