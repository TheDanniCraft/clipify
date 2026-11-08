import { z } from "zod";
import { exportPresetSchema, type ExportPreset } from "./clipExportPreset";
import { clipLayoutSchema } from "./clipLayout";
import { compositionSchema } from "./clipComposition";
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
export const clipExportOutputSchema = z.object({ key, label: z.string().trim().min(1).max(80), layout: z.union([clipLayoutSchema, compositionSchema]).optional(), templateId: key.optional(), format: z.enum(["desktop", "mobile"]).optional() });
export type ClipExportOutput = z.infer<typeof clipExportOutputSchema>;
export const clipExportPlanSchema = z
	.object({
		creatorId: z.string().min(1).max(200),
		preset: exportPresetSchema.optional(),
		outputs: z.array(clipExportOutputSchema).min(1).max(50),
		files: z
			.array(z.object({ clipId: key, outputKey: key }))
			.min(1)
			.max(50),
	})
	.refine((plan) => {
		const keys = plan.outputs.map((output) => output.key);
		return new Set(keys).size === keys.length && plan.files.every((file) => keys.includes(file.outputKey)) && new Set(plan.files.map((file) => JSON.stringify([file.clipId, file.outputKey]))).size === plan.files.length;
	}, "Select distinct clips and output versions.");
export type ClipExportPlan = z.infer<typeof clipExportPlanSchema>;
export function createClipExportPlan(creatorId: string, clipIds: string[], outputs: ClipExportOutput[], preset?: ExportPreset): ClipExportPlan[] {
	const ids = [...new Set(clipIds)];
	if (!ids.length || !outputs.length) throw new Error("Select clips and at least one output version.");
	const snapshots = z.array(clipExportOutputSchema).parse(outputs);
	if (new Set(snapshots.map((output) => output.key)).size !== snapshots.length) throw new Error("Select distinct output versions.");
	const files = ids.flatMap((clipId) => snapshots.map((output) => ({ clipId, outputKey: output.key }))),
		batches: ClipExportPlan[] = [];
	for (let offset = 0; offset < files.length; offset += 50) {
		const batch = files.slice(offset, offset + 50),
			keys = new Set(batch.map((file) => file.outputKey));
		batches.push(clipExportPlanSchema.parse({ creatorId, preset, files: batch, outputs: snapshots.filter((output) => keys.has(output.key)) }));
	}
	return batches;
}
