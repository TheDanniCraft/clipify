import { z } from "zod";
import { eventSourceSchema, type EventCategory } from "./eventConfiguration";
const httpsUrl = z.url().refine((value) => /^https:\/\//i.test(value), "Use a secure media URL.");
export const candidateInputSchema = z
	.object({
		kind: eventSourceSchema,
		reference: z.string().max(2048).default(""),
		title: z.string().trim().min(1).max(160),
		description: z.string().max(5000).default(""),
		thumbnailUrl: httpsUrl.optional(),
		mediaUrl: z.union([httpsUrl, z.string().regex(/^\/api\/events\/[0-9a-f-]{36}\/media\/[0-9a-f-]{36}$/i)]).optional(),
		createdAt: z.iso.datetime({ offset: true }).optional(),
		views: z.number().int().nonnegative().optional(),
		duration: z.number().nonnegative().optional(),
		creatorId: z.string().max(200).optional(),
		storageAssetId: z.uuid().optional(),
	})
	.strict();
export type EventCandidateContent = z.infer<typeof candidateInputSchema>;
export function canonicalCandidateKey(candidate: Pick<EventCandidateContent, "kind" | "reference">, submissionId: string) {
	return ["clip", "youtube", "game", "person", "choice"].includes(candidate.kind) ? `${candidate.kind}:${candidate.kind === "person" ? candidate.reference.toLowerCase() : candidate.reference}` : `submission:${submissionId}`;
}
export function candidateMatchesRules(candidate: EventCandidateContent, hostCreatorId: string, rules: EventCategory["rules"]) {
	if (candidate.kind === "clip" && candidate.creatorId !== hostCreatorId) return false;
	if (rules.startedAt && (!candidate.createdAt || Date.parse(candidate.createdAt) < Date.parse(rules.startedAt))) return false;
	if (rules.endedAt && (!candidate.createdAt || Date.parse(candidate.createdAt) >= Date.parse(rules.endedAt))) return false;
	if (rules.minViews !== undefined && (candidate.views ?? -1) < rules.minViews) return false;
	if (rules.minDuration !== undefined && (candidate.duration ?? -1) < rules.minDuration) return false;
	if (rules.maxDuration !== undefined && (candidate.duration === undefined || candidate.duration > rules.maxDuration)) return false;
	const title = candidate.title.toLocaleLowerCase("en");
	if (rules.titleIncludes && !title.includes(rules.titleIncludes.toLocaleLowerCase("en"))) return false;
	if (rules.titleExcludes && title.includes(rules.titleExcludes.toLocaleLowerCase("en"))) return false;
	return true;
}
export function visibleCandidates<T extends { nominated: boolean; parentId: string | null }>(candidates: T[]): T[] {
	return candidates.filter((candidate) => candidate.nominated && !candidate.parentId);
}
export function votingResults(candidates: { id: string; votes: number }[], tiePolicy: "shared" | "team", chosenWinner?: string) {
	const total = candidates.reduce((sum, c) => sum + c.votes, 0);
	const maximum = Math.max(0, ...candidates.map((c) => c.votes));
	const tied = candidates.filter((c) => c.votes === maximum);
	return candidates.map((c) => ({ ...c, percentage: total > 0 ? (100 * c.votes) / total : 0, winner: maximum > 0 && c.votes === maximum && (tiePolicy === "shared" || tied.length === 1 || c.id === chosenWinner) }));
}
