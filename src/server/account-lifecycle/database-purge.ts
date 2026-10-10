import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { accountDeletionRequestsTable, creatorAccountsTable, creatorIdentityLinksTable, usersTable, auditEventsTable, notificationOutboxTable } from "@/db/schema";
import { organization, user, member } from "@/db/auth-schema";
/** Only finalized, expired deletion requests may reach the destructive transaction. */
export async function purgeDueDatabaseAccounts(input: { now?: Date; limit?: number } = {}, client: Pick<typeof db, "select" | "transaction"> = db) {
	const now = input.now ?? new Date();
	const candidates = await client
		.select({ id: accountDeletionRequestsTable.id })
		.from(accountDeletionRequestsTable)
		.where(and(inArray(accountDeletionRequestsTable.status, ["suspended", "purge_eligible"]), lte(accountDeletionRequestsTable.purgeEligibleAt, now)))
		.limit(input.limit ?? 20);
	let purged = 0;
	for (const candidate of candidates) {
		const changed = await client.transaction(async (tx) => {
			const [request] = await tx.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.id, candidate.id)).for("update");
			if (!request || !["suspended", "purge_eligible"].includes(request.status) || !request.purgeEligibleAt || request.purgeEligibleAt > now) return false;
			const [account] = await tx.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, request.organizationId)).for("update");
			if (!account || !["suspended", "purge_eligible"].includes(account.status)) return false;
			const [creator] = await tx.select().from(usersTable).where(eq(usersTable.id, account.creatorId)).for("update");
			if (!creator) return false;
			const [identityLink] = await tx.select().from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, creator.id));
			const [identity] = identityLink ? await tx.select().from(user).where(eq(user.id, identityLink.authUserId)).for("update") : [];
			const recipient = identity?.email || creator.email;
			// Keep a non-identifying audit tombstone; the org/request cascade is intentional.
			await tx.insert(auditEventsTable).values({ targetType: "account_deletion_request", targetId: request.id, action: "account.deletion.purge", outcome: "success", correlationId: `account-purge:${request.id}`, metadata: { purgedAt: now.toISOString() } });
			await tx.delete(usersTable).where(eq(usersTable.id, creator.id));
			await tx.delete(organization).where(eq(organization.id, request.organizationId));
			if (identity) {
				const [otherCreator] = await tx.select({ id: creatorIdentityLinksTable.creatorId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.authUserId, identity.id)).limit(1);
				const [otherMembership] = await tx.select({ id: member.id }).from(member).where(eq(member.userId, identity.id)).limit(1);
				if (!otherCreator && !otherMembership) await tx.delete(user).where(eq(user.id, identity.id));
			}
			if (recipient)
				await tx
					.insert(notificationOutboxTable)
					.values({ eventType: "account-deleted", recipient, templateVersion: "account-deleted-v1", locale: "en", payload: { type: "account-deleted" }, scheduledAt: now, dedupeKey: `account-deleted:${request.id}` })
					.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
			return true;
		});
		if (changed) purged++;
	}
	return { purged };
}
