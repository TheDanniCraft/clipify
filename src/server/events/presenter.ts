import "server-only";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardSubmissionsTable as submissions, awardVotesTable as votes, usersTable } from "@/db/schema";
import { hasAwardPresenterSecret, EventError, eventError } from "./persistence";
import { readPublicAwardEvent } from "./public-read";
import { updateAwardDataSnapshot } from "./freeze";
import { createAwardPreviewToken } from "@/auth/event-preview-token";
import type { EventCandidateContent } from "@/app/lib/eventCandidates";
import { readCreatorBrand } from "@/server/creator-brand";
export async function readAwardPresenter(id: string, secret: string, now = new Date()) {
	if (!z.uuid().safeParse(id).success) return eventError(new EventError("NOT_FOUND"));
	try {
		const owner = await db.transaction(async (tx) => {
			const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1).for("update");
			if (!event?.publishedAt || !hasAwardPresenterSecret(event, secret)) throw new EventError("NOT_FOUND");
			const [creator] = await tx.select({ username: usersTable.username, disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
			if (!creator || creator.disabled) throw new EventError("NOT_FOUND");
			if (now >= new Date(event.configuration.schedule.submissionsEnd)) await updateAwardDataSnapshot(tx, event, now);
			return { id: event.ownerId, name: creator.username, mediaToken: createAwardPreviewToken(event, now) };
		});
		const view = await readPublicAwardEvent(id, undefined, secret, now);
		if (!view.ok) return view;
		const presenterMedia = (content: EventCandidateContent) => (content.mediaUrl?.startsWith(`/api/events/${id}/media/`) || content.mediaUrl?.startsWith(`/api/events/${id}/clips/`) ? { ...content, mediaUrl: `${content.mediaUrl}?preview=${encodeURIComponent(owner.mediaToken)}` } : content);
		for (const category of view.event.categories) {
			category.candidates = category.candidates.map((candidate) => ({ ...candidate, content: presenterMedia(candidate.content) }));
			if (category.dataResult?.status === "ready" && category.dataResult.content) category.dataResult.content = presenterMedia(category.dataResult.content);
		}
		const [brand, submitted, nominated, voted] = await Promise.all([
			readCreatorBrand(owner.id),
			db
				.select({ count: sql<number>`count(*)::integer` })
				.from(submissions)
				.where(and(eq(submissions.eventId, id), isNull(submissions.withdrawnAt))),
			db
				.select({ count: sql<number>`count(*)::integer` })
				.from(candidates)
				.where(and(eq(candidates.eventId, id), eq(candidates.nominated, true), isNull(candidates.parentId))),
			db
				.select({ count: sql<number>`count(distinct ${votes.authUserId})::integer` })
				.from(votes)
				.where(eq(votes.eventId, id)),
		]);
		let clips: number | null = null;
		if (view.event.slides?.some((slide) => slide.statistics.some((stat) => stat.source === "clips"))) {
			try {
				clips = (await (await import("@/server/clip-cache-read")).readCachedClipsByOwner(owner.id)).length;
			} catch {
				clips = null;
			}
		}
		return { ok: true as const, event: view.event, creatorName: owner.name, brand: brand.brand, statistics: { submissions: submitted[0].count, categories: view.event.categories.length, nominees: nominated[0].count, voters: voted[0].count, clips } };
	} catch (error) {
		return eventError(error);
	}
}

export async function publishAwardPresenterResults(id: string, secret: string, now = new Date()) {
	if (!z.uuid().safeParse(id).success) return eventError(new EventError("NOT_FOUND"));
	try {
		return await db.transaction(async (tx) => {
			const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1).for("update");
			if (!event?.publishedAt || !hasAwardPresenterSecret(event, secret)) throw new EventError("NOT_FOUND");
			const [owner] = await tx.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
			if (!owner || owner.disabled) throw new EventError("NOT_FOUND");
			const { publishLockedAwardResults } = await import("./lifecycle");
			await publishLockedAwardResults(tx, event, now);
			return { ok: true as const };
		});
	} catch (error) {
		return eventError(error);
	}
}
