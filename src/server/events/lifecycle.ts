import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError, lockAwardEvent, managedEvent, presenterDigest } from "./persistence";
import { getActivePartnerAccessGrant } from "@/app/lib/entitlements";

export async function publishAwardEvent(principal: TrustedCreatorPrincipal, ownerId: string, id: string, revision: number, now = new Date()) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (event.revision !== revision) throw new EventError("CONFLICT");
			if (event.publishedAt || now >= new Date(event.configuration.schedule.submissionsEnd)) throw new EventError("PHASE_CLOSED");
			if (event.configuration.visibility === "public" && !(await getActivePartnerAccessGrant(ownerId, now))) throw new EventError("PARTNER_REQUIRED");
			if (event.configuration.categories.some((c) => ["image", "audio", "video"].includes(c.source))) throw new EventError("STORAGE_REQUIRED");
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (!event.publishedAt || now < new Date(event.configuration.schedule.votingEnd)) throw new EventError("PHASE_CLOSED");
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:update", tx);
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
