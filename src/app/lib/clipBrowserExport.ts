import { z } from "zod";
import { compositionSchema } from "./clipComposition";
const png = z
	.string()
	.max(2 * 1024 * 1024)
	.regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
export const browserOutputSchema = z.object({ key: z.string().min(1).max(200), label: z.string().max(80), layout: compositionSchema.nullable(), assets: z.record(z.string(), png).refine((v) => Object.keys(v).length <= 32), watermark: png.nullable() });
export type BrowserOutput = z.infer<typeof browserOutputSchema>;
export const browserClipMetadataSchema = z.object({
	id: z.string().max(200),
	title: z.string().max(1000),
	url: z.string().max(4096).optional(),
	categoryId: z.string().max(200).nullable().optional(),
	createdAt: z.string().max(100).optional(),
	views: z.number().finite().nonnegative().optional(),
	duration: z.number().finite().nonnegative().optional(),
	thumbnailUrl: z.string().max(4096).nullable().optional(),
	broadcasterId: z.string().max(200).optional(),
	broadcasterName: z.string().max(200).nullable().optional(),
	clipCreatorId: z.string().max(200).nullable().optional(),
	clipCreatorName: z.string().max(200).nullable().optional(),
	videoId: z.string().max(200).nullable().optional(),
	vodOffsetSeconds: z.number().finite().nullable().optional(),
	language: z.string().max(100).nullable().optional(),
	isFeatured: z.boolean().nullable().optional(),
});
export const browserExportSchema = z.object({ ok: z.literal(true), clips: z.array(browserClipMetadataSchema.extend({ error: z.literal("clip_unavailable").optional(), sourceToken: z.string().max(4096), outputs: z.array(browserOutputSchema).max(50) })).max(50) });
export type BrowserExport = z.infer<typeof browserExportSchema>;
export type ExportEngine = "browser" | "server";
