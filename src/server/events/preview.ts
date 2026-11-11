import "server-only";
import { eq, sql, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardVotesTable as votes, awardSubmissionsTable as submissions, usersTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { createAwardPreviewToken, hasAwardPreviewToken } from "@/auth/event-preview-token";
import { EventError, eventError, lockAwardEvent } from "./persistence";
import { projectAwardEvent } from "@/app/lib/eventPublicView";
import { readCreatorBrand } from "@/server/creator-brand";
import type { EventCandidateContent } from "@/app/lib/eventCandidates";
import { resolveUserEntitlements } from "@/app/lib/entitlements";

export async function createAwardPreview(principal: TrustedCreatorPrincipal, ownerId: string, id: string, now = new Date()) {
	if (!z.uuid().safeParse(id).success) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			const token = createAwardPreviewToken(event, now);
			authority.assertAuthorityCurrent();
			return { ok: true as const, token };
		});
	} catch (error) {
		return eventError(error);
	}
}

export async function readAwardPreview(id: string, token: string, now = new Date()) {
	if (!z.uuid().safeParse(id).success || typeof token !== "string" || token.length > 100) return eventError(new EventError("NOT_FOUND"));
	try {
		const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
		if (!event || !hasAwardPreviewToken(event, token, now)) throw new EventError("NOT_FOUND");
		const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
		if (!owner || owner.disabled) throw new EventError("NOT_FOUND");
		const [rows, counts, brand, submitted, voted] = await Promise.all([
			db.select().from(candidates).where(eq(candidates.eventId, id)),
			db
				.select({ candidateId: votes.candidateId, votes: sql<number>`count(*)::integer` })
				.from(votes)
				.where(eq(votes.eventId, id))
				.groupBy(votes.candidateId),
			readCreatorBrand(event.ownerId),
			db
				.select({ count: sql<number>`count(*)::integer` })
				.from(submissions)
				.where(and(eq(submissions.eventId, id), isNull(submissions.withdrawnAt))),
			db
				.select({ count: sql<number>`count(distinct ${votes.authUserId})::integer` })
				.from(votes)
				.where(eq(votes.eventId, id)),
		]);
		const configuration = { ...event.configuration, whiteLabel: event.configuration.whiteLabel && (await resolveUserEntitlements(owner)).proAccess };
		const frozenResults = { ...event.frozenResults };
		for (const category of configuration.categories) if (category.manualResult && !frozenResults[category.id]) frozenResults[category.id] = { ...category.manualResult, status: "ready", source: "manual", asOf: now.toISOString() };
		const view = projectAwardEvent(
			{ ...event, configuration, publishedAt: event.publishedAt ?? now, resultsPublishedAt: null, reviewReleased: true, frozenResults },
			rows.map((row) => ({ ...row, nominated: configuration.categories.find((category) => category.id === row.categoryId)?.selection === "data" ? row.nominated : !row.parentId })),
			counts,
			true,
			new Date(Math.max(now.getTime(), Date.parse(configuration.schedule.votingEnd) + 1)),
		);
		const previewMedia = (content: EventCandidateContent) => (content.mediaUrl?.startsWith(`/api/events/${id}/media/`) ? { ...content, mediaUrl: `${content.mediaUrl}?preview=${encodeURIComponent(token)}` } : content);
		for (const category of view.categories) {
			category.candidates = category.candidates.map((candidate) => ({ ...candidate, content: previewMedia(candidate.content) }));
			if (category.dataResult?.status === "ready" && category.dataResult.content) category.dataResult.content = previewMedia(category.dataResult.content);
		}
		const clips = configuration.slides.some((slide) => slide.statistics.some((stat) => stat.source === "clips")) ? (await (await import("@/server/clip-cache-read")).readCachedClipsByOwner(event.ownerId)).length : null;
		return {
			ok: true as const,
			event: view,
			nomineeCounts: Object.fromEntries(view.categories.map((category) => [category.id, category.selection === "data" ? category.candidates.length : rows.filter((row) => row.categoryId === category.id && row.nominated && !row.parentId).length])),
			creatorName: owner.username,
			brand: brand.brand,
			statistics: { submissions: submitted[0].count, categories: view.categories.length, nominees: rows.filter((row) => !row.parentId).length, voters: voted[0].count, clips },
		};
	} catch (error) {
		return eventError(error);
	}
}
