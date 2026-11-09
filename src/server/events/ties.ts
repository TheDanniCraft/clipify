import "server-only";
import { eq, isNull, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type TransactionClient } from "@/db/client";
import { awardCandidatesTable as candidates, awardVotesTable as votes, awardEventsTable as events } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError, lockAwardEvent, type AwardEvent } from "./persistence";
export async function awardTiedLeaders(tx: TransactionClient, event: AwardEvent) {
	if (event.configuration.tiePolicy !== "team") return [];
	const rows = await tx
		.select({ id: candidates.id, categoryId: candidates.categoryId, content: candidates.content, votes: sql<number>`count(${votes.candidateId})::integer` })
		.from(candidates)
		.leftJoin(votes, and(eq(votes.eventId, event.id), eq(votes.candidateId, candidates.id)))
		.where(and(eq(candidates.eventId, event.id), eq(candidates.nominated, true), isNull(candidates.parentId)))
		.groupBy(candidates.id, candidates.categoryId, candidates.content);
	return event.configuration.categories
		.filter((category) => category.selection !== "data")
		.flatMap((category) => {
			const eligible = rows.filter((candidate) => candidate.categoryId === category.id),
				maximum = Math.max(0, ...eligible.map((candidate) => candidate.votes)),
				leaders = eligible.filter((candidate) => candidate.votes === maximum);
			return maximum > 0 && leaders.length > 1 ? [{ id: category.id, title: category.title, candidates: leaders.map((candidate) => ({ id: candidate.id, title: candidate.content.title, votes: candidate.votes })), winnerId: event.tieWinners[category.id] ?? null }] : [];
		});
}
export async function readAwardTieResults(principal: TrustedCreatorPrincipal, ownerId: string, id: string, now = new Date()) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx),
				event = await lockAwardEvent(tx, ownerId, id);
			if (!event.publishedAt || now < new Date(event.configuration.schedule.votingEnd)) throw new EventError("PHASE_CLOSED");
			const categories = await awardTiedLeaders(tx, event);
			authority.assertAuthorityCurrent();
			return { ok: true as const, categories };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function chooseAwardTieWinner(principal: TrustedCreatorPrincipal, ownerId: string, id: string, categoryId: string, candidateId: string, now = new Date()) {
	if (!z.uuid().safeParse(categoryId).success || !z.uuid().safeParse(candidateId).success) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx),
				event = await lockAwardEvent(tx, ownerId, id);
			if (!event.publishedAt || event.resultsPublishedAt || now < new Date(event.configuration.schedule.votingEnd)) throw new EventError("PHASE_CLOSED");
			const tied = (await awardTiedLeaders(tx, event)).find((category) => category.id === categoryId);
			if (!tied?.candidates.some((candidate) => candidate.id === candidateId)) throw new EventError("INVALID_INPUT");
			await tx
				.update(events)
				.set({ tieWinners: { ...event.tieWinners, [categoryId]: candidateId }, updatedAt: now })
				.where(eq(events.id, id));
			authority.assertAuthorityCurrent();
			return { ok: true as const };
		});
	} catch (error) {
		return eventError(error);
	}
}
