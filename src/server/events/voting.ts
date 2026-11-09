import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { awardVotesTable as votes, awardCandidatesTable as candidates } from "@/db/schema";
import { lockPublicAwardEvent, awardPhase } from "./submissions";
import { EventError, eventError } from "./persistence";
/** Caller supplies only the authenticated participant's user ID. */
export async function saveAwardVotes(authUserId: string, eventId: string, categoryId: string, selected: string[], now?: Date) {
	if (!authUserId || !Array.isArray(selected) || selected.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) || new Set(selected).size !== selected.length) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const event = await lockPublicAwardEvent(tx, eventId);
			if (awardPhase(event, now ?? new Date()) !== "voting") throw new EventError("PHASE_CLOSED");
			const category = event.configuration.categories.find((c) => c.id === categoryId);
			if (!category || category.selection === "data") throw new EventError("INVALID_INPUT");
			if (selected.length > event.configuration.votesPerCategory) throw new EventError("LIMIT_REACHED");
			const eligible = selected.length
				? await tx
						.select({ id: candidates.id })
						.from(candidates)
						.where(and(eq(candidates.eventId, eventId), eq(candidates.categoryId, categoryId), eq(candidates.nominated, true), isNull(candidates.parentId), inArray(candidates.id, selected)))
				: [];
			if (eligible.length !== selected.length) throw new EventError("INVALID_INPUT");
			await tx.delete(votes).where(and(eq(votes.eventId, eventId), eq(votes.categoryId, categoryId), eq(votes.authUserId, authUserId)));
			if (selected.length) await tx.insert(votes).values(selected.map((candidateId) => ({ eventId, categoryId, candidateId, authUserId })));
			return { ok: true as const, selected };
		});
	} catch (error) {
		return eventError(error);
	}
}
