import "server-only";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardEventsTable as events } from "@/db/schema";
import { fetchClipDiscovery } from "@/server/resources/clip-discovery";
import { candidateInputSchema, candidateMatchesRules } from "@/app/lib/eventCandidates";
import { awardDataResultSchema, type AwardDataResult } from "@/app/lib/eventResults";
import type { EventCategory } from "@/app/lib/eventConfiguration";
async function observeCategory(event: typeof events.$inferSelect, category: EventCategory, now: Date): Promise<AwardDataResult> {
	const saved = awardDataResultSchema.safeParse(event.frozenResults?.[category.id]);
	if (saved.success && saved.data.status === "ready" && saved.data.source === "manual") return saved.data;
	if (category.manualResult) return { status: "ready", source: "manual", ...category.manualResult, description: category.manualResult.description, asOf: now.toISOString() };
	if (category.source !== "clip") return { status: "missing", reason: "manual_required" };
	const previous = awardDataResultSchema.safeParse(event.frozenResults?.[category.id]);
	try {
		const discovered = await fetchClipDiscovery(event.ownerId, { startedAt: category.rules.startedAt, endedAt: category.rules.endedAt, sort: "most_viewed" });
		if (!discovered.complete) return previous.success && previous.data.status === "ready" ? previous.data : { status: "missing", reason: "incomplete_library" };
		const clips = discovered.clips
			.map((clip) => candidateInputSchema.safeParse({ kind: "clip", reference: clip.id, title: clip.title, description: "", creatorId: clip.broadcaster_id, ...(clip.creator_name ? { clipperName: clip.creator_name } : {}), createdAt: clip.created_at, views: clip.view_count ?? 0, duration: clip.duration, ...(clip.thumbnail_url ? { thumbnailUrl: clip.thumbnail_url } : {}) }))
			.flatMap((parsed) => (parsed.success && candidateMatchesRules(parsed.data, event.ownerId, category.rules) ? [parsed.data] : []))
			.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.reference.localeCompare(b.reference));
		const winner = clips[0];
		if (!winner) return { status: "missing", reason: "no_candidates" };
		return { status: "ready", source: "clips", title: winner.title, description: "", value: winner.views, content: winner, asOf: now.toISOString() };
	} catch {
		return previous.success && previous.data.status === "ready" ? previous.data : { status: "missing", reason: "unavailable" };
	}
}
export async function updateAwardDataSnapshot(tx: TransactionClient, event: typeof events.$inferSelect, now: Date) {
	if (event.frozenAt || !event.publishedAt || now < new Date(event.configuration.schedule.submissionsStart)) return;
	const started = performance.now();
	const current = () => new Date(now.getTime() + performance.now() - started);
	const cutoff = new Date(event.configuration.schedule.submissionsEnd);
	const results: Record<string, AwardDataResult> = {};
	for (const category of event.configuration.categories.filter((c) => c.selection === "data")) {
		if (current() < cutoff) {
			const observed = await observeCategory(event, category, now);
			if (current() < cutoff) {
				results[category.id] = observed;
				continue;
			}
		}
		{
			const previous = awardDataResultSchema.safeParse(event.frozenResults?.[category.id]);
			results[category.id] = previous.success ? previous.data : category.manualResult ? { status: "ready", source: "manual", ...category.manualResult, asOf: cutoff.toISOString() } : { status: "missing", reason: "no_snapshot" };
		}
	}
	if (!Object.keys(results).length) return;
	await tx
		.update(events)
		.set({ frozenResults: results, frozenAt: current() >= cutoff ? cutoff : null, updatedAt: current() })
		.where(eq(events.id, event.id));
}
export async function refreshAwardDataResults(now = new Date()) {
	const started = performance.now();
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(events)
			.where(and(isNotNull(events.publishedAt), isNull(events.frozenAt), sql`${events.configuration}->'categories' @> '[{"selection":"data"}]'::jsonb`, sql`(${events.configuration}->'schedule'->>'submissionsStart')::timestamptz <= ${now.toISOString()}::timestamptz`))
			.orderBy(asc(events.updatedAt))
			.limit(20)
			.for("update", { skipLocked: true });
		for (const event of rows) await updateAwardDataSnapshot(tx, event, new Date(now.getTime() + performance.now() - started));
		return rows.length;
	});
}

import { z } from "zod";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError, lockAwardEvent } from "./persistence";
export const manualAwardResultInput = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(5000).default(""), value: z.number().finite().optional(), reference: z.string().max(2048).optional() }).strict();
export async function setAwardDataResult(principal: TrustedCreatorPrincipal, ownerId: string, eventId: string, categoryId: string, raw: unknown, now?: Date) {
	const parsed = manualAwardResultInput.safeParse(raw);
	if (!parsed.success || !z.uuid().safeParse(eventId).success) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:review", tx);
			const event = await lockAwardEvent(tx, ownerId, eventId);
			const current = now ?? new Date();
			if (!event.publishedAt || event.resultsPublishedAt) throw new EventError("PHASE_CLOSED");
			const category = event.configuration.categories.find((c) => c.id === categoryId);
			if (!category || category.selection !== "data") throw new EventError("INVALID_INPUT");
			const content = parsed.data.reference ? await (await import("./sources")).resolveAwardSource(ownerId, category, { reference: parsed.data.reference, title: parsed.data.title, description: parsed.data.description }) : undefined;
			await updateAwardDataSnapshot(tx, event, current);
			const [latest] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
			const result: AwardDataResult = { status: "ready", source: "manual", title: content?.title ?? parsed.data.title, description: parsed.data.description, ...(parsed.data.value !== undefined ? { value: parsed.data.value } : {}), asOf: current.toISOString(), ...(content ? { content } : {}) };
			await tx
				.update(events)
				.set({ frozenResults: { ...latest.frozenResults, [categoryId]: result }, updatedAt: current })
				.where(eq(events.id, eventId));
			authority.assertAuthorityCurrent();
			return { ok: true as const, result };
		});
	} catch (error) {
		return eventError(error);
	}
}
