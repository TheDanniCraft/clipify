import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardCandidatesTable as candidates, awardEventsTable as events } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError, lockAwardEvent } from "./persistence";
import { candidateInputSchema, canonicalCandidateKey, candidateMatchesRules } from "@/app/lib/eventCandidates";
import type { EventCategory } from "@/app/lib/eventConfiguration";

export function isAwardReviewOpen(event: typeof events.$inferSelect, now: Date) {
	return !!event.publishedAt && !event.reviewReleased && now < new Date(event.configuration.schedule.votingEnd) && (event.configuration.schedule.reviewRequired || now < new Date(event.configuration.schedule.votingStart));
}
async function reviewMutation<T>(principal: TrustedCreatorPrincipal, ownerId: string, id: string, categoryId: string | undefined, now: Date | undefined, operation: (tx: TransactionClient, category: EventCategory | undefined, event: typeof events.$inferSelect) => Promise<T>) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			const current = now ?? new Date();
			if (!isAwardReviewOpen(event, current)) throw new EventError("PHASE_CLOSED");
			const category = event.configuration.categories.find((c) => c.id === categoryId);
			if (categoryId && (!category || category.selection === "data")) throw new EventError("INVALID_INPUT");
			const result = await operation(tx, category, event);
			authority.assertAuthorityCurrent();
			return { ok: true as const, ...result };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function groupAwardCandidates(principal: TrustedCreatorPrincipal, ownerId: string, id: string, categoryId: string, ids: string[], title: string, now?: Date) {
	return reviewMutation(principal, ownerId, id, categoryId, now, async (tx, category) => {
		if (!category || !["text", "link"].includes(category.source) || ids.length < 2 || ids.length > 1000 || new Set(ids).size !== ids.length || !title.trim() || title.trim().length > 160) throw new EventError("INVALID_INPUT");
		const rows = await tx
			.select()
			.from(candidates)
			.where(and(eq(candidates.eventId, id), eq(candidates.categoryId, categoryId), inArray(candidates.id, ids), isNull(candidates.parentId)));
		if (rows.length !== ids.length || rows.some((row) => row.canonicalKey.startsWith("group:"))) throw new EventError("INVALID_INPUT");
		const [group] = await tx
			.insert(candidates)
			.values({ eventId: id, categoryId, canonicalKey: `group:${randomUUID()}`, content: { kind: category.source, title: title.trim(), description: "", reference: "" } })
			.returning();
		await tx.update(candidates).set({ parentId: group.id, nominated: false }).where(inArray(candidates.id, ids));
		return { candidate: group };
	});
}
export async function nominateAwardCandidates(principal: TrustedCreatorPrincipal, ownerId: string, id: string, categoryId: string, ids: string[], now?: Date) {
	return reviewMutation(principal, ownerId, id, categoryId, now, async (tx, category) => {
		if (!category || new Set(ids).size !== ids.length || ids.length > 1000) throw new EventError("INVALID_INPUT");
		if (category.nomineeLimit !== null && ids.length > category.nomineeLimit) throw new EventError("LIMIT_REACHED");
		const rows = ids.length
			? await tx
					.select()
					.from(candidates)
					.where(and(eq(candidates.eventId, id), eq(candidates.categoryId, categoryId), inArray(candidates.id, ids), isNull(candidates.parentId)))
			: [];
		if (rows.length !== ids.length) throw new EventError("INVALID_INPUT");
		await tx
			.update(candidates)
			.set({ nominated: false })
			.where(and(eq(candidates.eventId, id), eq(candidates.categoryId, categoryId)));
		if (ids.length) await tx.update(candidates).set({ nominated: true }).where(inArray(candidates.id, ids));
		return { nomineeIds: ids };
	});
}
export async function releaseAwardReview(principal: TrustedCreatorPrincipal, ownerId: string, id: string, now?: Date) {
	return reviewMutation(principal, ownerId, id, undefined, now, async (tx) => {
		const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1);
		if ((now ?? new Date()) < new Date(event.configuration.schedule.submissionsEnd)) throw new EventError("PHASE_CLOSED");
		await tx
			.update(events)
			.set({ reviewReleased: true, updatedAt: now ?? new Date() })
			.where(eq(events.id, id));
		return { released: true };
	});
}

export async function readAwardReview(principal: TrustedCreatorPrincipal, ownerId: string, id: string) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			const rows = await tx.select().from(candidates).where(eq(candidates.eventId, id));
			authority.assertAuthorityCurrent();
			return { ok: true as const, candidates: rows, event: { configuration: event.configuration, published: !!event.publishedAt, reviewReleased: event.reviewReleased, frozenAt: event.frozenAt, frozenResults: event.frozenResults, resultsPublishedAt: event.resultsPublishedAt } };
		});
	} catch (error) {
		return eventError(error);
	}
}

async function writeTeamCandidate(tx: TransactionClient, event: typeof events.$inferSelect, category: EventCategory, raw: unknown) {
	const parsed = candidateInputSchema.safeParse(raw);
	if (!parsed.success || parsed.data.kind !== category.source || !candidateMatchesRules(parsed.data, event.ownerId, category.rules)) throw new EventError("INVALID_INPUT");
	const key = canonicalCandidateKey(parsed.data, randomUUID());
	const [existing] = await tx
		.select()
		.from(candidates)
		.where(and(eq(candidates.eventId, event.id), eq(candidates.categoryId, category.id), eq(candidates.canonicalKey, key)))
		.limit(1);
	if (existing) return { candidate: existing };
	const [candidate] = await tx.insert(candidates).values({ eventId: event.id, categoryId: category.id, canonicalKey: key, content: parsed.data, nominated: !event.configuration.schedule.reviewRequired }).returning();
	return { candidate };
}
export async function addAwardTeamCandidate(principal: TrustedCreatorPrincipal, ownerId: string, eventId: string, categoryId: string, input: unknown, now?: Date) {
	return reviewMutation(principal, ownerId, eventId, categoryId, now, async (tx, category, event) => {
		if (!category) throw new EventError("INVALID_INPUT");
		const content = await (await import("./sources")).resolveAwardSource(ownerId, category, input);
		if (!isAwardReviewOpen(event, now ?? new Date())) throw new EventError("PHASE_CLOSED");
		return writeTeamCandidate(tx, event, category, content);
	});
}
/** Storage adapters supply validated provider metadata; this boundary rechecks team authority and the current phase. */
export async function commitAwardTeamCandidate(tx: TransactionClient, principal: TrustedCreatorPrincipal, ownerId: string, eventId: string, categoryId: string, content: unknown) {
	const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx);
	const event = await lockAwardEvent(tx, ownerId, eventId);
	if (!isAwardReviewOpen(event, new Date())) throw new EventError("PHASE_CLOSED");
	const category = event.configuration.categories.find((c) => c.id === categoryId);
	if (!category || category.selection === "data") throw new EventError("INVALID_INPUT");
	const result = await writeTeamCandidate(tx, event, category, content);
	authority.assertAuthorityCurrent();
	return result;
}
