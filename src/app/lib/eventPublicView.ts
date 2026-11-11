import { awardDataResultSchema } from "./eventResults";
import { eventPhase } from "./events";
import { visibleCandidates, votingResults } from "./eventCandidates";
import type { EventCandidateContent } from "./eventCandidates";
import { DEFAULT_AWARD_PRESENTATION } from "./eventConfiguration";
import type { EventConfiguration } from "./eventConfiguration";
type EventViewInput = { id: string; ownerId: string; configuration: EventConfiguration; publishedAt: Date | null; resultsPublishedAt: Date | null; reviewReleased: boolean; tieWinners?: Record<string, string>; frozenResults: Record<string, unknown> | null };
type CandidateViewInput = { id: string; categoryId: string; content: EventCandidateContent; nominated: boolean; parentId: string | null };
export function projectAwardEvent(event: EventViewInput, candidates: CandidateViewInput[], counts: { candidateId: string; votes: number }[], presenter = false, now = new Date()) {
	const phase = eventPhase({ schedule: event.configuration.schedule, published: !!event.publishedAt, resultsPublished: !!event.resultsPublishedAt, reviewReleased: event.reviewReleased }, now);
	const reveal = (presenter && phase === "closed") || !!event.resultsPublishedAt;
	const categories = event.configuration.categories
		.filter((c) => c.selection !== "data" || reveal || presenter)
		.map((category) => {
			let nominees = visibleCandidates(candidates.filter((c) => c.categoryId === category.id)).map((c) => ({ id: c.id, content: c.content }));
			const dataResult = reveal && category.selection === "data" ? (awardDataResultSchema.safeParse(event.frozenResults?.[category.id]).data ?? null) : null;
			if (category.selection === "data" && dataResult?.status === "ready") {
				const winner = dataResult.content ?? { kind: "text" as const, reference: "", title: dataResult.title, description: dataResult.description };
				const pool = (category.dataNomineeSource ?? (category.source === "clip" ? "top" : "team")) === "team" ? nominees.map(({ content }) => content) : (dataResult.nominees ?? []);
				const extra = pool.filter((content) => !(content.kind === winner.kind && content.reference === winner.reference && (content.reference || content.title === winner.title)));
				nominees = [{ id: `data:${category.id}:${winner.kind}:${winner.reference || winner.title}`, content: winner }, ...extra.map((content) => ({ id: `data:${category.id}:${content.kind}:${content.reference || content.title}`, content }))].slice(0, category.nomineeLimit ?? extra.length + 1);
			}
			const results =
				reveal && category.selection !== "data"
					? votingResults(
							nominees.map((c) => ({ id: c.id, votes: counts.find((v) => v.candidateId === c.id)?.votes ?? 0 })),
							event.configuration.tiePolicy,
							event.tieWinners?.[category.id],
						)
					: undefined;
			return {
				id: category.id,
				title: category.title,
				group: category.group,
				source: category.source,
				selection: category.selection,
				presenterMode: category.presenterMode ?? (category.selection === "data" ? "winner" : "nominees"),
				submissionLimit: category.submissionLimit,
				rules: category.rules,
				options: category.options,
				candidates: phase === "announcement" || phase === "submissions" ? [] : nominees,
				...(reveal && category.selection === "data" ? { dataResult } : {}),
				...(results ? { results: results.map((result) => (presenter || event.configuration.resultDetail === "votes" ? result : event.configuration.resultDetail === "percentages" ? { id: result.id, percentage: result.percentage, winner: result.winner } : { id: result.id, winner: result.winner })) } : {}),
			};
		});
	return { id: event.id, ownerId: event.ownerId, title: event.configuration.title, description: event.configuration.description, schedule: event.configuration.schedule, phase, votesPerCategory: event.configuration.votesPerCategory, whiteLabel: event.configuration.whiteLabel, categories, ...(presenter ? { slides: event.configuration.slides, presentation: event.configuration.presentation ?? DEFAULT_AWARD_PRESENTATION } : {}) };
}
export type PublicAwardEvent = ReturnType<typeof projectAwardEvent>;
