"use server";

import { Entitlement, EntitlementGrantSource } from "@types";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { validateAdminAuth } from "@actions/auth";
import { db } from "@/db/client";
import { auditEventsTable, entitlementGrantsTable, userBadgesTable, usersTable } from "@/db/schema";
import { badgeCatalog, isBadgeSlug } from "@lib/badgeCatalog";
import { queueGrantEmails } from "@/server/notifications/benefit-events";
import { queueBadgeEmail } from "@/server/notifications/badge-events";

export type AdminAwardInput = { userIds: string[]; operationId: string; kind: "pro_access" | "runner_access" | "badge"; days: number | null; badge?: string; reason: string };
export async function grantAdminAwards(input: AdminAwardInput) {
	const admin = await validateAdminAuth(true);
	if (!admin) throw new Error("ADMIN_REQUIRED");
	if (!input || !Array.isArray(input.userIds) || input.userIds.length < 1 || input.userIds.length > 100 || input.userIds.some((id) => typeof id !== "string" || !id) || new Set(input.userIds).size !== input.userIds.length) throw new Error("INVALID_RECIPIENTS");
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.operationId)) throw new Error("INVALID_OPERATION_ID");
	if (!["pro_access", "runner_access", "badge"].includes(input.kind)) throw new Error("INVALID_AWARD");
	const reason = typeof input.reason === "string" ? input.reason.trim() : "";
	if (!reason || reason.length > 500) throw new Error("PUBLIC_REASON_REQUIRED");
	if (input.kind === "badge") {
		if (!input.badge || !isBadgeSlug(input.badge) || "condition" in badgeCatalog[input.badge]) throw new Error("BADGE_IS_AUTOMATIC_OR_UNKNOWN");
	} else if (input.days !== null && (!Number.isInteger(input.days) || input.days < 1 || input.days > 3650)) throw new Error("INVALID_DURATION");
	const results: Array<{ userId: string; status: "granted" | "unchanged" | "failed"; error?: string }> = [];
	for (const userId of input.userIds) {
		try {
			const changed = await db.transaction(async (tx) => {
				const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).for("update");
				if (!user) throw new Error("USER_NOT_FOUND");
				const now = new Date();
				if (input.kind === "badge") {
					const [award] = await tx
						.insert(userBadgesTable)
						.values({ userId, badge: input.badge as keyof typeof badgeCatalog, source: "admin", awardedBy: null })
						.onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badge] })
						.returning();
					if (!award) return false;
					await queueBadgeEmail(award, "awarded", tx);
				} else {
					const [grant] = await tx
						.insert(entitlementGrantsTable)
						.values({ userId, entitlement: input.kind === "pro_access" ? Entitlement.ProAccess : Entitlement.RunnerAccess, source: EntitlementGrantSource.Support, reason, startsAt: now, endsAt: input.days === null ? null : new Date(now.getTime() + input.days * 86400000), externalReference: `admin:${admin.id}:${input.operationId}:${userId}` })
						.onConflictDoNothing({ target: [entitlementGrantsTable.source, entitlementGrantsTable.externalReference, entitlementGrantsTable.entitlement] })
						.returning();
					if (!grant) return false;
					await queueGrantEmails(grant, tx);
				}
				await tx.insert(auditEventsTable).values({ targetType: "user", targetId: userId, action: input.kind === "badge" ? "badge.award" : "entitlement.grant", outcome: "success", correlationId: input.operationId, metadata: { administratorId: admin.id, kind: input.kind, badge: input.badge ?? null, reason } });
				return true;
			});
			results.push({ userId, status: changed ? "granted" : "unchanged" });
		} catch (error) {
			results.push({ userId, status: "failed", error: error instanceof Error && error.message === "USER_NOT_FOUND" ? "USER_NOT_FOUND" : "AWARD_FAILED" });
		}
	}
	return { results };
}
export async function getAdminUserAwards(userId: string) {
	if (!(await validateAdminAuth(true))) throw new Error("ADMIN_REQUIRED");
	const [grants, badges] = await Promise.all([
		db
			.select()
			.from(entitlementGrantsTable)
			.where(and(eq(entitlementGrantsTable.userId, userId), inArray(entitlementGrantsTable.source, [EntitlementGrantSource.Support, EntitlementGrantSource.Promo, EntitlementGrantSource.Partner, EntitlementGrantSource.System]), isNull(entitlementGrantsTable.revokedAt))),
		db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId)),
	]);
	const now = Date.now();
	return { grants: grants.map((grant) => ({ ...grant, partnershipEnded: grant.source === EntitlementGrantSource.Partner && grant.entitlement === Entitlement.ProAccess && !!grant.endsAt && grant.endsAt.getTime() <= now })), badges };
}
export async function revokeAdminAward(input: { userId: string; grantId?: string; badge?: string }) {
	const admin = await validateAdminAuth(true);
	if (!admin) throw new Error("ADMIN_REQUIRED");
	return db.transaction(async (tx) => {
		const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, input.userId)).for("update");
		if (!user) throw new Error("USER_NOT_FOUND");
		if (input.grantId && !input.badge) {
			const [existing] = await tx
				.select()
				.from(entitlementGrantsTable)
				.where(and(eq(entitlementGrantsTable.id, input.grantId), eq(entitlementGrantsTable.userId, input.userId), isNull(entitlementGrantsTable.revokedAt)))
				.for("update");
			if (!existing) return { changed: false };
			const partner = existing.source === EntitlementGrantSource.Partner && existing.entitlement === Entitlement.ProAccess;
			const now = new Date();
			if (partner && existing.endsAt && existing.endsAt <= now) return { changed: false };
			const [grant] = await tx
				.update(entitlementGrantsTable)
				.set(partner ? { endsAt: now, updatedAt: now } : { revokedAt: now, updatedAt: now })
				.where(and(eq(entitlementGrantsTable.id, input.grantId), eq(entitlementGrantsTable.userId, input.userId), inArray(entitlementGrantsTable.source, [EntitlementGrantSource.Support, EntitlementGrantSource.Promo, EntitlementGrantSource.Partner, EntitlementGrantSource.System]), isNull(entitlementGrantsTable.revokedAt)))
				.returning();
			if (!grant) return { changed: false };
			const { queueGrantRevocation } = await import("@/server/notifications/benefit-events");
			if (partner) await queueGrantEmails(grant, tx, false);
			else await queueGrantRevocation(grant, tx);
		} else if (input.badge && !input.grantId) {
			if (!isBadgeSlug(input.badge) || "condition" in badgeCatalog[input.badge]) throw new Error("BADGE_IS_AUTOMATIC_OR_UNKNOWN");
			const [badge] = await tx
				.delete(userBadgesTable)
				.where(and(eq(userBadgesTable.userId, input.userId), eq(userBadgesTable.badge, input.badge)))
				.returning();
			if (!badge) return { changed: false };
			await queueBadgeEmail(badge, "removed", tx);
		} else throw new Error("INVALID_AWARD");
		await tx.insert(auditEventsTable).values({ targetType: "user", targetId: input.userId, action: input.grantId ? "entitlement.revoke" : "badge.remove", outcome: "success", correlationId: randomUUID(), metadata: { administratorId: admin.id, grantId: input.grantId ?? null, badge: input.badge ?? null } });
		return { changed: true };
	});
}
