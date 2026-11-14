import { z } from "zod";
import { candidateInputSchema } from "./eventCandidates";
export const awardDataResultSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("ready"), source: z.enum(["clips", "manual"]), title: z.string().trim().min(1).max(160), description: z.string().max(5000), value: z.number().finite().optional(), asOf: z.iso.datetime(), content: candidateInputSchema.optional(), nominees: z.array(candidateInputSchema).optional() }),
	z.object({ status: z.literal("missing"), reason: z.enum(["no_snapshot", "incomplete_library", "no_candidates", "manual_required", "unavailable"]) }),
]);
export type AwardDataResult = z.infer<typeof awardDataResultSchema>;
