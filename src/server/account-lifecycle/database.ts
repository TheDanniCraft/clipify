import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import * as databaseSchema from "@/db/schema";
import { accountDeletionRequestsTable, auditEventsTable, billingSubscriptionsTable, creatorAccountsTable, entitlementGrantsTable, galleriesTable, notificationOutboxTable, overlaysTable, playlistsTable, runnersTable, usersTable } from "@/db/schema";
import { member as authMemberTable, session as authSessionTable, user as authUserTable } from "@/db/auth-schema";
import { getAuthActorContext, type ActorContext } from "@/auth/session";
import { assertOwnerAndRecent, DELETION_RECOVERY_MS, type DeletionChoice, type LifecycleActor } from "./service";
import { buildDeletionNotificationIntents, buildRecoveryNotificationIntent } from "@/server/notifications/templates/account-lifecycle";

type BillingMutationInput = {
	id: string;
	status: string;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
};

const NONTERMINAL_DELETION_STATUSES = ["scheduled", "suspended", "purge_eligible"] as const;

async function requireOwnerActor(now: Date): Promise<{ actor: ActorContext; lifecycleActor: LifecycleActor; organizationId: string; email: string }> {
	const actor = await getAuthActorContext();
	if (!actor) throw new Error("AUTHENTICATION_REQUIRED");
	const organizationId = actor.activeOrganizationId ?? (await db.select({ organizationId: creatorAccountsTable.organizationId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, actor.creatorId)).limit(1))[0]?.organizationId;
	if (!organizationId) throw new Error("ACCOUNT_NOT_FOUND");
	const [membership, identity] = await Promise.all([
		db
			.select({ role: authMemberTable.role })
			.from(authMemberTable)
			.where(and(eq(authMemberTable.organizationId, organizationId), eq(authMemberTable.userId, actor.authUserId)))
			.limit(1),
		db.select({ email: authUserTable.email }).from(authUserTable).where(eq(authUserTable.id, actor.authUserId)).limit(1),
	]);
	const lifecycleActor: LifecycleActor = {
		authUserId: actor.authUserId,
		sessionId: actor.sessionId,
		organizationId,
		accountRole: membership[0]?.role === "owner" ? "owner" : "member",
		authenticatedAt: actor.authenticatedAt,
	};
	assertOwnerAndRecent(lifecycleActor, now);
	const email = identity[0]?.email;
	if (!email) throw new Error("VERIFIED_EMAIL_REQUIRED");
	return { actor, lifecycleActor, organizationId, email };
}

export async function requestDatabaseAccountDeletion(input: { choice: DeletionChoice; now?: Date; mutateBilling?: (subscription: BillingMutationInput, choice: DeletionChoice) => Promise<void> }) {
	const now = input.now ?? new Date();
	const { actor, lifecycleActor, organizationId, email } = await requireOwnerActor(now);
	const [existing, subscription] = await Promise.all([
		db
			.select({ id: accountDeletionRequestsTable.id })
			.from(accountDeletionRequestsTable)
			.where(and(eq(accountDeletionRequestsTable.organizationId, organizationId), inArray(accountDeletionRequestsTable.status, NONTERMINAL_DELETION_STATUSES)))
			.limit(1),
		db.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, actor.creatorId)).limit(1),
	]);
	if (existing[0]) throw new Error("DELETION_ALREADY_REQUESTED");
	const billing = subscription[0] ?? null;
	if (billing) await input.mutateBilling?.(billing, input.choice);

	const suspensionAt = input.choice === "paid_through" && billing?.currentPeriodEnd && billing.currentPeriodEnd > now ? billing.currentPeriodEnd : now;
	const suspended = suspensionAt.getTime() <= now.getTime();
	const purgeEligibleAt = new Date(suspensionAt.getTime() + DELETION_RECOVERY_MS);
	const requestId = randomUUID();
	const stripeSnapshot = billing ? { subscriptionId: billing.id, status: billing.status, currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: input.choice === "paid_through" ? true : billing.cancelAtPeriodEnd } : {};
	const notificationIntents = buildDeletionNotificationIntents({ requestId, recipient: email, requestedAt: now, suspensionAt, purgeEligibleAt });

	await db.transaction(async (tx) => {
		await tx.insert(accountDeletionRequestsTable).values({
			id: requestId,
			organizationId,
			choice: input.choice,
			status: suspended ? "suspended" : "scheduled",
			requestedBy: lifecycleActor.authUserId,
			requestedAt: now,
			suspensionAt,
			suspendedAt: suspended ? now : null,
			purgeEligibleAt: suspended ? purgeEligibleAt : null,
			stripeSnapshot,
		});
		await tx
			.update(creatorAccountsTable)
			.set({ status: suspended ? "suspended" : "suspension_scheduled", suspensionAt, purgeEligibleAt: suspended ? purgeEligibleAt : null, updatedAt: now })
			.where(eq(creatorAccountsTable.organizationId, organizationId));
		if (billing) await tx.update(billingSubscriptionsTable).set({ cancelAtPeriodEnd: true, updatedAt: now }).where(eq(billingSubscriptionsTable.id, billing.id));
		await tx.insert(notificationOutboxTable).values(
			notificationIntents.map((intent) => ({
				eventType: "account-lifecycle",
				recipient: intent.recipient,
				authorityOrganizationId: organizationId,
				templateVersion: intent.templateVersion,
				locale: "en",
				payload: { ...intent.payload, boundary: intent.boundary },
				scheduledAt: intent.scheduledAt,
				dedupeKey: intent.dedupeKey,
			})),
		);
		await tx.insert(auditEventsTable).values({
			actorUserId: lifecycleActor.authUserId,
			actorSessionId: lifecycleActor.sessionId,
			accountOrganizationId: organizationId,
			targetType: "account_deletion_request",
			targetId: requestId,
			action: "account.deletion.request",
			outcome: "success",
			correlationId: `account-deletion:${requestId}`,
			metadata: { choice: input.choice, suspensionAt: suspensionAt.toISOString(), purgeEligibleAt: purgeEligibleAt.toISOString() },
		});
		if (suspended) {
			const agencyLicenseAllocationsTable = databaseSchema.agencyLicenseAllocationsTable as typeof databaseSchema.agencyLicenseAllocationsTable | undefined;
			if (agencyLicenseAllocationsTable)
				await tx
					.update(agencyLicenseAllocationsTable)
					.set({ status: "released_by_deletion", endsAt: now, updatedAt: now })
					.where(and(eq(agencyLicenseAllocationsTable.creatorId, actor.creatorId), inArray(agencyLicenseAllocationsTable.status, ["active", "removal_scheduled"])));
			await tx.delete(authSessionTable).where(eq(authSessionTable.userId, actor.authUserId));
		}
	});

	return { id: requestId, choice: input.choice, status: suspended ? ("suspended" as const) : ("scheduled" as const), suspensionAt: suspensionAt.toISOString(), purgeEligibleAt: suspended ? purgeEligibleAt.toISOString() : null };
}

export async function recoverDatabaseAccountDeletion(input: { requestId: string; now?: Date }) {
	const now = input.now ?? new Date();
	const { lifecycleActor, organizationId, email } = await requireOwnerActor(now);
	return db.transaction(async (tx) => {
		const requests = await tx
			.select()
			.from(accountDeletionRequestsTable)
			.where(and(eq(accountDeletionRequestsTable.id, input.requestId), eq(accountDeletionRequestsTable.organizationId, organizationId)))
			.limit(1);
		const request = requests[0];
		if (!request) throw new Error("DELETION_REQUEST_NOT_FOUND");
		if (request.status === "recovered") return { recovered: true, alreadyRecovered: true };
		if (request.status !== "suspended" || !request.purgeEligibleAt || now >= request.purgeEligibleAt) throw new Error("RECOVERY_PERIOD_ENDED");
		const [updated] = await tx
			.update(accountDeletionRequestsTable)
			.set({ status: "recovered", recoveredBy: lifecycleActor.authUserId, recoveredAt: now, version: request.version + 1, updatedAt: now })
			.where(and(eq(accountDeletionRequestsTable.id, request.id), eq(accountDeletionRequestsTable.version, request.version), eq(accountDeletionRequestsTable.status, "suspended")))
			.returning({ id: accountDeletionRequestsTable.id });
		if (!updated) throw new Error("LIFECYCLE_CONFLICT");
		await tx.update(creatorAccountsTable).set({ status: "active", suspensionAt: null, purgeEligibleAt: null, updatedAt: now }).where(eq(creatorAccountsTable.organizationId, organizationId));
		const intent = buildRecoveryNotificationIntent({ requestId: request.id, recipient: email, recoveredAt: now });
		await tx
			.insert(notificationOutboxTable)
			.values({ eventType: "account-lifecycle", recipient: intent.recipient, authorityOrganizationId: organizationId, templateVersion: intent.templateVersion, locale: "en", payload: { ...intent.payload, boundary: intent.boundary }, scheduledAt: intent.scheduledAt, dedupeKey: intent.dedupeKey })
			.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
		await tx.insert(auditEventsTable).values({ actorUserId: lifecycleActor.authUserId, actorSessionId: lifecycleActor.sessionId, accountOrganizationId: organizationId, targetType: "account_deletion_request", targetId: request.id, action: "account.deletion.recover", outcome: "success", correlationId: `account-recovery:${request.id}`, metadata: {} });
		return { recovered: true, alreadyRecovered: false };
	});
}

export async function getDatabaseAccountDeletionOverview() {
	const now = new Date();
	const actor = await getAuthActorContext();
	if (!actor) throw new Error("AUTHENTICATION_REQUIRED");
	const organizationId = actor.activeOrganizationId ?? (await db.select({ organizationId: creatorAccountsTable.organizationId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, actor.creatorId)).limit(1))[0]?.organizationId;
	if (!organizationId) throw new Error("ACCOUNT_NOT_FOUND");
	const rows = await db
		.select({ id: accountDeletionRequestsTable.id, choice: accountDeletionRequestsTable.choice, status: accountDeletionRequestsTable.status, suspensionAt: accountDeletionRequestsTable.suspensionAt, purgeEligibleAt: accountDeletionRequestsTable.purgeEligibleAt })
		.from(accountDeletionRequestsTable)
		.where(and(eq(accountDeletionRequestsTable.organizationId, organizationId), inArray(accountDeletionRequestsTable.status, NONTERMINAL_DELETION_STATUSES)))
		.limit(1);
	const request = rows[0];
	return request
		? {
				...request,
				suspensionAt: request.suspensionAt.toISOString(),
				purgeEligibleAt: request.purgeEligibleAt?.toISOString() ?? null,
				recoveryPeriodEnded: request.status === "purge_eligible" || !request.purgeEligibleAt || now >= request.purgeEligibleAt,
			}
		: null;
}

export async function suspendDueDatabaseAccountDeletions(input: { now?: Date; limit?: number } = {}) {
	const now = input.now ?? new Date();
	const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
	const due = await db
		.select({ id: accountDeletionRequestsTable.id })
		.from(accountDeletionRequestsTable)
		.where(and(eq(accountDeletionRequestsTable.status, "scheduled"), lte(accountDeletionRequestsTable.suspensionAt, now)))
		.limit(limit);
	let suspended = 0;
	for (const candidate of due) {
		const applied = await db.transaction(async (tx) => {
			const rows = await tx
				.select()
				.from(accountDeletionRequestsTable)
				.where(and(eq(accountDeletionRequestsTable.id, candidate.id), eq(accountDeletionRequestsTable.status, "scheduled")))
				.limit(1);
			const request = rows[0];
			if (!request) return false;
			const purgeEligibleAt = new Date(now.getTime() + DELETION_RECOVERY_MS);
			const [updated] = await tx
				.update(accountDeletionRequestsTable)
				.set({ status: "suspended", suspendedAt: now, purgeEligibleAt, version: request.version + 1, updatedAt: now })
				.where(and(eq(accountDeletionRequestsTable.id, request.id), eq(accountDeletionRequestsTable.version, request.version), eq(accountDeletionRequestsTable.status, "scheduled")))
				.returning({ id: accountDeletionRequestsTable.id });
			if (!updated) return false;
			await tx.update(creatorAccountsTable).set({ status: "suspended", suspensionAt: now, purgeEligibleAt, updatedAt: now }).where(eq(creatorAccountsTable.organizationId, request.organizationId));
			const creator = await tx.select({ creatorId: creatorAccountsTable.creatorId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, request.organizationId)).limit(1);
			const agencyLicenseAllocationsTable = databaseSchema.agencyLicenseAllocationsTable as typeof databaseSchema.agencyLicenseAllocationsTable | undefined;
			if (creator[0] && agencyLicenseAllocationsTable)
				await tx
					.update(agencyLicenseAllocationsTable)
					.set({ status: "released_by_deletion", endsAt: now, updatedAt: now })
					.where(and(eq(agencyLicenseAllocationsTable.creatorId, creator[0].creatorId), inArray(agencyLicenseAllocationsTable.status, ["active", "removal_scheduled"])));
			if (request.requestedBy) await tx.delete(authSessionTable).where(eq(authSessionTable.userId, request.requestedBy));
			const identity = request.requestedBy ? await tx.select({ email: authUserTable.email }).from(authUserTable).where(eq(authUserTable.id, request.requestedBy)).limit(1) : [];
			const recipient = identity[0]?.email;
			if (recipient) {
				const intents = buildDeletionNotificationIntents({ requestId: request.id, recipient, requestedAt: request.requestedAt, suspensionAt: now, purgeEligibleAt });
				for (const intent of intents.filter((item) => item.boundary !== "request")) {
					await tx
						.update(notificationOutboxTable)
						.set({ scheduledAt: intent.scheduledAt, payload: { ...intent.payload, boundary: intent.boundary }, updatedAt: now })
						.where(eq(notificationOutboxTable.dedupeKey, intent.dedupeKey));
				}
			}
			await tx.insert(auditEventsTable).values({ actorUserId: request.requestedBy, actorSessionId: "lifecycle-scheduler", accountOrganizationId: request.organizationId, targetType: "account_deletion_request", targetId: request.id, action: "account.deletion.suspend", outcome: "success", correlationId: `account-suspension:${request.id}`, metadata: { purgeEligibleAt: purgeEligibleAt.toISOString() } });
			return true;
		});
		if (applied) suspended += 1;
	}
	return { scanned: due.length, suspended };
}

export async function exportDatabaseAccountData(input: { now?: Date } = {}) {
	const now = input.now ?? new Date();
	const { actor, organizationId } = await requireOwnerActor(now);
	return collectDatabaseAccountData({ actor, organizationId, now });
}

export async function prepareDatabaseAccountDataExport(input: { now?: Date } = {}) {
	const now = input.now ?? new Date();
	const { actor, organizationId, email } = await requireOwnerActor(now);
	return { authUserId: actor.authUserId, creatorId: actor.creatorId, organizationId, email };
}

export async function downloadDatabaseAccountDataExport(input: { authUserId: string; creatorId: string; organizationId: string; now?: Date }) {
	const actor = await getAuthActorContext();
	if (!actor) throw new Error("AUTHENTICATION_REQUIRED");
	if (actor.authUserId !== input.authUserId || actor.creatorId !== input.creatorId) throw new Error("EXPORT_IDENTITY_MISMATCH");
	const membership = await db
		.select({ id: authMemberTable.id })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, input.organizationId), eq(authMemberTable.userId, actor.authUserId)))
		.limit(1);
	if (!membership[0]) throw new Error("EXPORT_IDENTITY_MISMATCH");
	const { collectComprehensiveAccountData } = await import("./account-data-export");
	return collectComprehensiveAccountData(input);
}

async function collectDatabaseAccountData(input: { actor: ActorContext; organizationId: string; now: Date }) {
	const { actor, organizationId, now } = input;
	const [profile, overlays, playlists, galleries, runners, subscriptions, entitlements, deletionRequests] = await Promise.all([
		db.select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, plan: usersTable.plan, createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt }).from(usersTable).where(eq(usersTable.id, actor.creatorId)).limit(1),
		db.select({ id: overlaysTable.id, name: overlaysTable.name, status: overlaysTable.status, type: overlaysTable.type, createdAt: overlaysTable.createdAt, updatedAt: overlaysTable.updatedAt }).from(overlaysTable).where(eq(overlaysTable.ownerId, actor.creatorId)),
		db.select({ id: playlistsTable.id, name: playlistsTable.name, createdAt: playlistsTable.createdAt, updatedAt: playlistsTable.updatedAt }).from(playlistsTable).where(eq(playlistsTable.ownerId, actor.creatorId)),
		db.select({ id: galleriesTable.id, name: galleriesTable.name, createdAt: galleriesTable.createdAt, updatedAt: galleriesTable.updatedAt }).from(galleriesTable).where(eq(galleriesTable.ownerId, actor.creatorId)),
		db.select({ id: runnersTable.id, name: runnersTable.name, status: runnersTable.status, createdAt: runnersTable.createdAt }).from(runnersTable).where(eq(runnersTable.ownerId, actor.creatorId)),
		db.select({ id: billingSubscriptionsTable.id, status: billingSubscriptionsTable.status, currentPeriodStart: billingSubscriptionsTable.currentPeriodStart, currentPeriodEnd: billingSubscriptionsTable.currentPeriodEnd, cancelAtPeriodEnd: billingSubscriptionsTable.cancelAtPeriodEnd }).from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, actor.creatorId)),
		db.select({ entitlement: entitlementGrantsTable.entitlement, source: entitlementGrantsTable.source, startsAt: entitlementGrantsTable.startsAt, endsAt: entitlementGrantsTable.endsAt, revokedAt: entitlementGrantsTable.revokedAt }).from(entitlementGrantsTable).where(eq(entitlementGrantsTable.userId, actor.creatorId)),
		db.select({ id: accountDeletionRequestsTable.id, choice: accountDeletionRequestsTable.choice, status: accountDeletionRequestsTable.status, requestedAt: accountDeletionRequestsTable.requestedAt, suspensionAt: accountDeletionRequestsTable.suspensionAt, purgeEligibleAt: accountDeletionRequestsTable.purgeEligibleAt, recoveredAt: accountDeletionRequestsTable.recoveredAt }).from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.organizationId, organizationId)),
	]);
	return {
		exportFormat: "clipify-account-data-v1",
		exportedAt: now.toISOString(),
		organizationId,
		securityNotice: "Reusable credentials are intentionally excluded. This package does not contain OAuth access or refresh tokens, session tokens, passkey key material, runner tokens, overlay secrets, or stream keys.",
		profile: profile[0] ?? null,
		overlays,
		playlists,
		galleries,
		runners,
		subscriptions,
		entitlements,
		deletionRequests,
	};
}
