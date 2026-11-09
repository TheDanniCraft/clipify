import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardSubmissionsTable as submissions } from "@/db/schema";
import { candidateInputSchema, canonicalCandidateKey, candidateMatchesRules } from "@/app/lib/eventCandidates";
import { eventPhase } from "@/app/lib/events";
import { EventError, eventError } from "./persistence";

export async function lockPublicAwardEvent(tx: TransactionClient, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new EventError("INVALID_INPUT");
	const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1).for("update");
	if (!event?.publishedAt) throw new EventError("NOT_FOUND");
	return event;
}
export function awardPhase(event: typeof events.$inferSelect, now: Date) {
	return eventPhase({ schedule: event.configuration.schedule, published: !!event.publishedAt, resultsPublished: !!event.resultsPublishedAt, reviewReleased: event.reviewReleased }, now);
}
/** authUserId must come from the verified Twitch participant session, never form input. */
export async function submitAwardCandidate(authUserId: string, eventId: string, categoryId: string, raw: unknown, now?: Date) {
	const parsed = candidateInputSchema.safeParse(raw);
	if (!authUserId || !parsed.success) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const event = await lockPublicAwardEvent(tx, eventId);
			if (awardPhase(event, now ?? new Date()) !== "submissions") throw new EventError("PHASE_CLOSED");
			const category = event.configuration.categories.find((c) => c.id === categoryId);
			if (!category || category.selection !== "audience" || category.source !== parsed.data.kind) throw new EventError("INVALID_INPUT");
			// External sources must be resolved and revalidated by the trusted source adapter before this transaction.
			if (!candidateMatchesRules(parsed.data, event.ownerId, category.rules)) throw new EventError("INVALID_INPUT");
			const active = await tx
				.select()
				.from(submissions)
				.where(and(eq(submissions.eventId, eventId), eq(submissions.categoryId, categoryId), eq(submissions.authUserId, authUserId), isNull(submissions.withdrawnAt)));
			const submissionId = randomUUID();
			const canonicalKey = canonicalCandidateKey(parsed.data, submissionId);
			const [existing] = await tx
				.select()
				.from(candidates)
				.where(and(eq(candidates.eventId, eventId), eq(candidates.categoryId, categoryId), eq(candidates.canonicalKey, canonicalKey)))
				.limit(1);
			const repeated = existing ? active.find((s) => s.candidateId === existing.id) : undefined;
			if (repeated) return { ok: true as const, submission: repeated };
			if (category.submissionLimit !== null && active.length >= category.submissionLimit) throw new EventError("LIMIT_REACHED");
			const candidate = existing ?? (await tx.insert(candidates).values({ eventId, categoryId, canonicalKey, content: parsed.data, nominated: !event.configuration.schedule.reviewRequired }).returning())[0];
			const [submission] = await tx.insert(submissions).values({ id: submissionId, eventId, categoryId, candidateId: candidate.id, authUserId, original: parsed.data }).returning();
			return { ok: true as const, submission };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function withdrawAwardSubmission(authUserId: string, eventId: string, id: string, now?: Date) {
	try {
		return await db.transaction(async (tx) => {
			const event = await lockPublicAwardEvent(tx, eventId);
			if (awardPhase(event, now ?? new Date()) !== "submissions") throw new EventError("PHASE_CLOSED");
			const [row] = await tx
				.update(submissions)
				.set({ withdrawnAt: now ?? new Date() })
				.where(and(eq(submissions.id, id), eq(submissions.eventId, eventId), eq(submissions.authUserId, authUserId), isNull(submissions.withdrawnAt)))
				.returning();
			if (!row) throw new EventError("NOT_FOUND");
			return { ok: true as const };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function ownAwardSubmissions(authUserId: string, eventId: string) {
	try {
		return {
			ok: true as const,
			submissions: await db
				.select()
				.from(submissions)
				.where(and(eq(submissions.eventId, eventId), eq(submissions.authUserId, authUserId), isNull(submissions.withdrawnAt))),
		};
	} catch (error) {
		return eventError(error);
	}
}
