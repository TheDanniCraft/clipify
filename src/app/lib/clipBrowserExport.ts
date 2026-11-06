import { z } from "zod";
import { compositionSchema } from "./clipComposition";
const png = z
	.string()
	.max(2 * 1024 * 1024)
	.regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
export const browserOutputSchema = z.object({ key: z.string().min(1).max(200), label: z.string().max(80), layout: compositionSchema.nullable(), assets: z.record(z.string(), png).refine((v) => Object.keys(v).length <= 32), watermark: png.nullable() });
export type BrowserOutput = z.infer<typeof browserOutputSchema>;
export const browserExportSchema = z.object({ ok: z.literal(true), clips: z.array(z.object({ id: z.string().max(200), title: z.string().max(1000), sourceToken: z.string().max(4096), outputs: z.array(browserOutputSchema).max(50) })).max(50) });
export type BrowserExport = z.infer<typeof browserExportSchema>;
export type ExportEngine = "browser" | "server";
