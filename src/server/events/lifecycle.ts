import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable, eventConnectionsTable, awardCandidatesTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError, lockAwardEvent, managedEvent, presenterDigest } from "./persistence";
import { getActivePartnerAccessGrant } from "@/app/lib/entitlements";

export async function publishAwardEvent(principal: TrustedCreatorPrincipal, ownerId: string, id: string, revision: number, now = new Date()) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:publish", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (event.revision !== revision) throw new EventError("CONFLICT");
			if (event.publishedAt || now >= new Date(event.configuration.schedule.submissionsEnd)) throw new EventError("PHASE_CLOSED");
			if (event.configuration.visibility === "public" && !(await getActivePartnerAccessGrant(ownerId, now))) throw new EventError("PARTNER_REQUIRED");
			if (event.configuration.categories.some((c) => ["image", "audio", "video"].includes(c.source))) {
				if (!event.configuration.storageConnectionId) throw new EventError("STORAGE_REQUIRED");
				const [storage] = await tx
					.select({ id: eventConnectionsTable.id })
					.from(eventConnectionsTable)
					.where(and(eq(eventConnectionsTable.id, event.configuration.storageConnectionId), eq(eventConnectionsTable.ownerId, ownerId), eq(eventConnectionsTable.connected, true), inArray(eventConnectionsTable.provider, ["s3", "drive"])))
					.limit(1);
				if (!storage) throw new EventError("STORAGE_REQUIRED");
			}
			for (const category of event.configuration.categories.filter((c) => c.selection === "team" && c.source === "choice")) {
				await tx
					.insert(awardCandidatesTable)
					.values(category.options.map((option) => ({ eventId: id, categoryId: category.id, canonicalKey: `choice:${option}`, content: { kind: "choice" as const, reference: option, title: option, description: "" }, nominated: !event.configuration.schedule.reviewRequired })))
					.onConflictDoNothing();
			}
			const [row] = await tx
				.update(awardEventsTable)
				.set({ publishedAt: now, revision: revision + 1, updatedAt: now })
				.where(eq(awardEventsTable.id, id))
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row) };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function publishAwardResults(principal: TrustedCreatorPrincipal, ownerId: string, id: string, now = new Date()) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:publish", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (!event.publishedAt || now < new Date(event.configuration.schedule.votingEnd)) throw new EventError("PHASE_CLOSED");
			const dataCategories = event.configuration.categories.filter((c) => c.selection === "data");
			if (dataCategories.length) {
				const { updateAwardDataSnapshot } = await import("./freeze");
				await updateAwardDataSnapshot(tx, event, now);
				const [latest] = await tx.select().from(awardEventsTable).where(eq(awardEventsTable.id, id)).limit(1);
				const { awardDataResultSchema } = await import("@/app/lib/eventResults");
				if (
					dataCategories.some((category) => {
						const result = awardDataResultSchema.safeParse(latest.frozenResults?.[category.id]);
						return !result.success || result.data.status !== "ready";
					})
				)
					throw new EventError("RESULTS_REQUIRED");
			}

			const [row] = await tx
				.update(awardEventsTable)
				.set({ resultsPublishedAt: event.resultsPublishedAt ?? now, updatedAt: now })
				.where(eq(awardEventsTable.id, id))
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row) };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function rotateAwardPresenterSecret(principal: TrustedCreatorPrincipal, ownerId: string, id: string) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event-presenter:rotate", tx);
			await lockAwardEvent(tx, ownerId, id);
			const secret = randomBytes(32).toString("base64url");
			await tx
				.update(awardEventsTable)
				.set({ presenterDigest: presenterDigest(secret), updatedAt: new Date() })
				.where(eq(awardEventsTable.id, id));
			authority.assertAuthorityCurrent();
			return { ok: true as const, presenterSecret: secret };
		});
	} catch (error) {
		return eventError(error);
	}
}
