import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardSubmissionsTable as submissions, awardAssetsTable, usersTable } from "@/db/schema";
import { candidateInputSchema, canonicalCandidateKey, candidateMatchesRules } from "@/app/lib/eventCandidates";
import { eventPhase } from "@/app/lib/events";
import { EventError, eventError } from "./persistence";

export async function lockPublicAwardEvent(tx: TransactionClient, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new EventError("INVALID_INPUT");
	// Match management lock order: creator lifecycle before the event row.
	const [owner] = await tx
		.select({ id: usersTable.id })
		.from(events)
		.innerJoin(usersTable, eq(usersTable.id, events.ownerId))
		.where(and(eq(events.id, id), eq(usersTable.disabled, false)))
		.limit(1)
		.for("share", { of: usersTable });
	if (!owner) throw new EventError("NOT_FOUND");
	const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1).for("update");
	if (!event?.publishedAt) throw new EventError("NOT_FOUND");
	return event;
}
export function awardPhase(event: typeof events.$inferSelect, now: Date) {
	return eventPhase({ schedule: event.configuration.schedule, published: !!event.publishedAt, resultsPublished: !!event.resultsPublishedAt, reviewReleased: event.reviewReleased }, now);
}
/** authUserId must come from the verified Twitch participant session, never form input. */
export async function submitAwardCandidate(authUserId: string, eventId: string, categoryId: string, raw: unknown, now?: Date) {
	try {
		return await db.transaction((tx) => commitAwardSubmission(tx, authUserId, eventId, categoryId, raw, now));
	} catch (error) {
		return eventError(error);
	}
}
export async function commitAwardSubmission(tx: TransactionClient, authUserId: string, eventId: string, categoryId: string, raw: unknown, now?: Date) {
	const parsed = candidateInputSchema.safeParse(raw);
	if (!authUserId || !parsed.success) throw new EventError("INVALID_INPUT");
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
	if (existing && !existing.parentId && !event.configuration.schedule.reviewRequired) await tx.update(candidates).set({ nominated: true }).where(eq(candidates.id, existing.id));
	const [submission] = await tx.insert(submissions).values({ id: submissionId, eventId, categoryId, candidateId: candidate.id, authUserId, original: parsed.data }).returning();
	return { ok: true as const, submission };
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
			const remaining = await tx
				.select({ id: submissions.id })
				.from(submissions)
				.where(and(eq(submissions.candidateId, row.candidateId), isNull(submissions.withdrawnAt)))
				.limit(1);
			if (!remaining.length) {
				await tx.update(candidates).set({ nominated: false }).where(eq(candidates.id, row.candidateId));
				if (row.original.storageAssetId)
					await tx
						.update(awardAssetsTable)
						.set({ state: "cleanup", updatedAt: now ?? new Date() })
						.where(and(eq(awardAssetsTable.id, row.original.storageAssetId), eq(awardAssetsTable.eventId, eventId)));
			}

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
