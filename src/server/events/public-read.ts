import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardVotesTable as votes, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { projectAwardEvent } from "@/app/lib/eventPublicView";
import { EventError, eventError, hasAwardPresenterSecret } from "./persistence";
/** participantId is supplied only from the current verified session by the action boundary. */
export async function readPublicAwardEvent(id: string, participantId?: string, secret?: string, now = new Date()) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return eventError(new EventError("NOT_FOUND"));
	try {
		const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
		if (!event?.publishedAt) throw new EventError("NOT_FOUND");
		const presenter = secret !== undefined;
		if (presenter && !hasAwardPresenterSecret(event, secret)) throw new EventError("NOT_FOUND");
		const [creator] = await db.select({ id: usersTable.id, disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
		if (!creator || creator.disabled) throw new EventError("NOT_FOUND");
		if (event.configuration.whiteLabel) {
			const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
			if (!(await resolveUserEntitlements(owner)).proAccess) event.configuration = { ...event.configuration, whiteLabel: false };
		}
		const rows = await db.select().from(candidates).where(eq(candidates.eventId, id));
		const reveal = !!event.resultsPublishedAt || (presenter && now >= new Date(event.configuration.schedule.votingEnd));
		const counts = reveal
			? await db
					.select({ candidateId: votes.candidateId, votes: sql<number>`count(*)::integer` })
					.from(votes)
					.where(eq(votes.eventId, id))
					.groupBy(votes.candidateId)
			: [];
		const selection = participantId
			? await db
					.select({ categoryId: votes.categoryId, candidateId: votes.candidateId })
					.from(votes)
					.where(and(eq(votes.eventId, id), eq(votes.authUserId, participantId)))
			: [];
		return { ok: true as const, event: projectAwardEvent(event, rows, counts, presenter, now), selection };
	} catch (error) {
		return eventError(error);
	}
}
