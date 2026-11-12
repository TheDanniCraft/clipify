import "server-only";
import { readPublicAwardEvent } from "./public-read";
import { readAwardPreview } from "./preview";
import type { EventCandidateContent } from "@/app/lib/eventCandidates";

export async function canPlayAwardClip(clipId: string, ownerId: string, eventId: string, previewToken?: string) {
	if (typeof eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(eventId) || !/^[a-zA-Z0-9_-]{1,200}$/.test(clipId) || (previewToken !== undefined && (typeof previewToken !== "string" || previewToken.length > 100))) return false;
	const matches = (content?: EventCandidateContent | null) => content?.kind === "clip" && content.reference === clipId && content.creatorId === ownerId;
	const view = previewToken !== undefined ? await readAwardPreview(eventId, previewToken) : await readPublicAwardEvent(eventId);
	if (view.ok && view.event.ownerId === ownerId && view.event.categories.some((category) => category.candidates.some((candidate) => matches(candidate.content)) || matches(category.dataResult?.status === "ready" ? category.dataResult.content : undefined))) return true;
	if (previewToken !== undefined) return false;
	const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return false;
	const { readAwardReview } = await import("./review");
	const review = await readAwardReview(principal, ownerId, eventId);
	if (!review.ok) return false;
	if (review.candidates.some((candidate) => matches(candidate.content))) return true;
	return Object.values(review.event.frozenResults ?? {}).some((result) => {
		if (!result || typeof result !== "object") return false;
		return matches((result as { content?: EventCandidateContent }).content);
	});
}
