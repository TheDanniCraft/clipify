import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { invitation as authInvitationTable, member as authMemberTable, organization as authOrganizationTable, organizationRole as authOrganizationRoleTable } from "@/db/auth-schema";
import { agencyAccountsTable, agencyBillingAccountsTable, agencyCreatorLinksTable, agencyLicenseAllocationsTable, auditEventsTable, creatorAccountsTable, creatorIdentityLinksTable, notificationOutboxTable, usersTable } from "@/db/schema";
import { getAuthSession } from "@/auth/session";
import { PERMISSIONS, STANDARD_ROLES, type Permission } from "@/auth/permissions";
import { resolveAgencyAccess } from "./access";
import { buildAgencyAllocationGrantIntent, buildAgencyAllocationRemovalIntents } from "@/server/notifications/templates/agency-allocation";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { sendPersistedInvitationEmail } from "@/auth/invitations";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type SessionEnvelope = { session: { id: string; userId: string; activeOrganizationId?: string | null } };

function validatedPermissions(input: readonly string[]): Permission[] {
	const unique = [...new Set(input)];
	if (unique.length !== input.length || unique.some((permission) => !PERMISSIONS.includes(permission as Permission))) throw new Error("INVALID_PERMISSION_CEILING");
	return unique as Permission[];
}

function parseRolePermissions(role: string, serialized?: string | null): Permission[] {
	if (role === "owner") return [...PERMISSIONS];
	const standard = STANDARD_ROLES[role as keyof typeof STANDARD_ROLES];
	if (standard) return [...standard];
	if (!serialized) return [];
	try {
		const statements = JSON.parse(serialized) as Record<string, string[]>;
		return validatedPermissions(Object.entries(statements).flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`)));
	} catch {
		return [];
	}
}

async function requireSession() {
	const envelope = (await getAuthSession()) as SessionEnvelope | null;
	if (!envelope?.session) throw new Error("AUTHENTICATION_REQUIRED");
	return envelope.session;
}

export async function requireAgencyMember(requiredPermission?: Permission) {
	const session = await requireSession();
	let organizationId = session.activeOrganizationId ?? null;
	if (!organizationId) throw new Error("AGENCY_CONTEXT_REQUIRED");
	let account = await db.select().from(agencyAccountsTable).where(eq(agencyAccountsTable.organizationId, organizationId)).limit(1);
	let membership = await db
		.select()
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, organizationId), eq(authMemberTable.userId, session.userId)))
		.limit(1);
	if (account[0]?.status === "owner_invited" && membership[0]?.role === "owner") {
		const [activated] = await db
			.update(agencyAccountsTable)
			.set({ status: "active", updatedAt: new Date() })
			.where(and(eq(agencyAccountsTable.organizationId, organizationId), eq(agencyAccountsTable.status, "owner_invited")))
			.returning();
		if (activated) account = [activated];
	}
	if (account[0] && (account[0].status !== "active" || !membership[0])) throw new Error("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
	if (!account[0] || !membership[0]) {
		const creatorContext = await db.select({ organizationId: creatorAccountsTable.organizationId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, organizationId)).limit(1);
		if (!creatorContext[0]) throw new Error("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
		const fallback = await db
			.select({ account: agencyAccountsTable, membership: authMemberTable })
			.from(authMemberTable)
			.innerJoin(agencyAccountsTable, eq(agencyAccountsTable.organizationId, authMemberTable.organizationId))
			.where(and(eq(authMemberTable.userId, session.userId), eq(agencyAccountsTable.status, "active")))
			.limit(1);
		if (!fallback[0]) throw new Error("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
		organizationId = fallback[0].account.organizationId;
		account = [fallback[0].account];
		membership = [fallback[0].membership];
	}
	if (!organizationId) throw new Error("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
	const customRole = await db
		.select({ permission: authOrganizationRoleTable.permission })
		.from(authOrganizationRoleTable)
		.where(and(eq(authOrganizationRoleTable.organizationId, organizationId), eq(authOrganizationRoleTable.role, membership[0].role)))
		.limit(1);
	const permissions = parseRolePermissions(membership[0].role, customRole[0]?.permission);
	if (requiredPermission && membership[0].role !== "owner" && !permissions.includes(requiredPermission)) throw new Error("PERMISSION_DENIED");
	return { session, account: account[0], membership: membership[0], permissions };
}

async function requireCreatorOwner(creatorOrganizationId: string) {
	const session = await requireSession();
	const membership = await db
		.select({ role: authMemberTable.role })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, creatorOrganizationId), eq(authMemberTable.userId, session.userId)))
		.limit(1);
	if (membership[0]?.role !== "owner") throw new Error("CREATOR_OWNER_REQUIRED");
	const creator = await db.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, creatorOrganizationId)).limit(1);
	if (!creator[0]) throw new Error("CREATOR_ACCOUNT_NOT_FOUND");
	return { session, creator: creator[0] };
}

export async function provisionDatabaseAgency(input: {
	name: string;
	ownerEmail: string;
	commercialReference?: string;
	creatorSeatLimit: number;
	billing?: {
		billingEmail: string;
		collectionMethod: "charge_automatically" | "send_invoice";
		daysUntilDue?: number | null;
		creatorSeatPriceId: string;
		creatorSeatMinimum: number;
		creatorSeatQuantity: number;
		runnerSeatPriceId?: string | null;
		runnerSeatMinimum: number;
		runnerSeatQuantity: number;
	};
	now?: Date;
}) {
	const { validateAuth } = await import("@actions/auth");
	const administrator = await validateAuth(true);
	if (!administrator) throw new Error("ADMIN_REQUIRED");
	const identity = await db.select({ authUserId: creatorIdentityLinksTable.authUserId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, administrator.id)).limit(1);
	if (!identity[0]) throw new Error("ADMIN_IDENTITY_REQUIRED");
	const now = input.now ?? new Date();
	const organizationId = randomUUID();
	const invitationId = randomUUID();
	const ownerEmail = input.ownerEmail.trim().toLowerCase();
	const name = input.name.trim();
	if (!name || !ownerEmail.includes("@") || !Number.isInteger(input.creatorSeatLimit) || input.creatorSeatLimit < 0) throw new Error("INVALID_AGENCY_PROVISIONING_INPUT");
	if (input.billing) {
		const billing = input.billing;
		const quantities = [billing.creatorSeatMinimum, billing.creatorSeatQuantity, billing.runnerSeatMinimum, billing.runnerSeatQuantity];
		if (
			!billing.billingEmail.includes("@") ||
			!billing.creatorSeatPriceId.startsWith("price_") ||
			quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0) ||
			billing.creatorSeatQuantity < billing.creatorSeatMinimum ||
			billing.runnerSeatQuantity < billing.runnerSeatMinimum ||
			(billing.runnerSeatQuantity > 0 && !billing.runnerSeatPriceId?.startsWith("price_")) ||
			(billing.collectionMethod === "send_invoice" && (!billing.daysUntilDue || billing.daysUntilDue < 1 || billing.daysUntilDue > 90))
		)
			throw new Error("INVALID_AGENCY_BILLING_TERMS");
	}
	const slug = `${
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 44) || "agency"
	}-${organizationId.slice(0, 8)}`;

	await db.transaction(async (tx) => {
		await tx.insert(authOrganizationTable).values({ id: organizationId, name, slug, createdAt: now, metadata: JSON.stringify({ accountType: "agency" }) });
		await tx.insert(agencyAccountsTable).values({ organizationId, status: "owner_invited", commercialReference: input.commercialReference?.trim() || null, creatorSeatLimit: input.creatorSeatLimit, provisionedBy: identity[0].authUserId, createdAt: now, updatedAt: now });
		if (input.billing) {
			await tx.insert(agencyBillingAccountsTable).values({
				organizationId,
				billingEmail: input.billing.billingEmail.trim().toLowerCase(),
				collectionMethod: input.billing.collectionMethod,
				daysUntilDue: input.billing.collectionMethod === "send_invoice" ? input.billing.daysUntilDue : null,
				creatorSeatPriceId: input.billing.creatorSeatPriceId,
				creatorSeatMinimum: input.billing.creatorSeatMinimum,
				creatorSeatQuantity: 0,
				pendingCreatorSeatQuantity: input.billing.creatorSeatQuantity,
				runnerSeatPriceId: input.billing.runnerSeatPriceId || null,
				runnerSeatMinimum: input.billing.runnerSeatMinimum,
				runnerSeatQuantity: 0,
				pendingRunnerSeatQuantity: input.billing.runnerSeatQuantity || null,
				createdAt: now,
				updatedAt: now,
			});
		}
		await tx.insert(authInvitationTable).values({ id: invitationId, organizationId, email: ownerEmail, role: "owner", status: "pending", expiresAt: new Date(now.getTime() + SEVEN_DAYS_MS), createdAt: now, inviterId: identity[0].authUserId });
		await tx.insert(notificationOutboxTable).values({ eventType: "agency-access", recipient: ownerEmail, authorityOrganizationId: organizationId, templateVersion: "agency-owner-invitation-v1", locale: "en", payload: { agencyName: name }, scheduledAt: now, dedupeKey: `agency-owner-invitation:${invitationId}` });
		await tx.insert(auditEventsTable).values({ actorUserId: identity[0].authUserId, accountOrganizationId: organizationId, targetType: "agency_account", targetId: organizationId, action: "agency.provision", outcome: "success", correlationId: `agency-provision:${organizationId}`, metadata: { creatorSeatLimit: input.creatorSeatLimit } });
	});
	const invitationUrl = new URL("/accept-invitation", resolveBaseUrl());
	invitationUrl.searchParams.set("invitationId", invitationId);
	let emailSent = false;
	if (process.env.E2E_TEST_MODE !== "true") {
		try {
			await sendPersistedInvitationEmail({ invitationId, email: ownerEmail });
			await db
				.update(notificationOutboxTable)
				.set({ status: "sent", providerMessageId: "direct-delivery", updatedAt: new Date() })
				.where(eq(notificationOutboxTable.dedupeKey, `agency-owner-invitation:${invitationId}`));
			emailSent = true;
		} catch (error) {
			console.error("[agency] owner invitation email failed", error);
		}
	}
	return { organizationId, invitationId, invitationUrl: invitationUrl.toString(), emailSent, status: "owner_invited" as const };
}

export async function activateDatabaseAgencyOwner(input: { organizationId: string; now?: Date }) {
	const session = await requireSession();
	const now = input.now ?? new Date();
	const membership = await db
		.select({ role: authMemberTable.role })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, input.organizationId), eq(authMemberTable.userId, session.userId)))
		.limit(1);
	if (membership[0]?.role !== "owner") throw new Error("AGENCY_OWNER_REQUIRED");
	const [updated] = await db
		.update(agencyAccountsTable)
		.set({ status: "active", updatedAt: now })
		.where(and(eq(agencyAccountsTable.organizationId, input.organizationId), eq(agencyAccountsTable.status, "owner_invited")))
		.returning();
	return updated ?? (await db.select().from(agencyAccountsTable).where(eq(agencyAccountsTable.organizationId, input.organizationId)).limit(1))[0];
}

/** Complete first-owner activation after Better Auth has atomically accepted the invitation. */
export async function activateCurrentInvitedAgency(input: { organizationId: string; now?: Date }) {
	const session = await requireSession();
	const account = await db.select().from(agencyAccountsTable).where(eq(agencyAccountsTable.organizationId, input.organizationId)).limit(1);
	if (!account[0]) return { agency: false as const, activated: false as const };
	const membership = await db
		.select({ role: authMemberTable.role })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, input.organizationId), eq(authMemberTable.userId, session.userId)))
		.limit(1);
	if (membership[0]?.role !== "owner") throw new Error("AGENCY_OWNER_REQUIRED");
	if (account[0].status === "active") return { agency: true as const, activated: false as const };
	if (account[0].status !== "owner_invited") throw new Error("AGENCY_ACTIVATION_STATE_INVALID");
	const [updated] = await db
		.update(agencyAccountsTable)
		.set({ status: "active", updatedAt: input.now ?? new Date() })
		.where(and(eq(agencyAccountsTable.organizationId, input.organizationId), eq(agencyAccountsTable.status, "owner_invited")))
		.returning({ organizationId: agencyAccountsTable.organizationId });
	return { agency: true as const, activated: Boolean(updated) };
}

export async function proposeDatabaseAgencyLink(input: { creatorOrganizationId: string; permissionCeiling: string[]; now?: Date }) {
	const actor = await requireAgencyMember("agency:link-creator");
	const now = input.now ?? new Date();
	const permissionCeiling = validatedPermissions(input.permissionCeiling);
	const creator = await db.select({ creatorId: creatorAccountsTable.creatorId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, input.creatorOrganizationId)).limit(1);
	if (!creator[0]) throw new Error("CREATOR_ACCOUNT_NOT_FOUND");
	const id = randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(agencyCreatorLinksTable).values({ id, agencyOrganizationId: actor.account.organizationId, creatorOrganizationId: input.creatorOrganizationId, status: "proposed", permissionCeiling, proposedBy: actor.session.userId, proposedAt: now, createdAt: now, updatedAt: now });
		await tx.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: actor.account.organizationId, targetType: "agency_creator_link", targetId: id, action: "agency-link.propose", outcome: "success", correlationId: `agency-link:${id}:propose`, metadata: { creatorOrganizationId: input.creatorOrganizationId, permissionCeiling } });
	});
	return { id, status: "proposed" as const };
}

export async function acceptDatabaseAgencyLink(input: { linkId: string; permissionCeiling: string[]; now?: Date }) {
	const link = await db.select().from(agencyCreatorLinksTable).where(eq(agencyCreatorLinksTable.id, input.linkId)).limit(1);
	if (!link[0] || link[0].status !== "proposed") throw new Error("AGENCY_LINK_NOT_PROPOSED");
	const actor = await requireCreatorOwner(link[0].creatorOrganizationId);
	const permissionCeiling = validatedPermissions(input.permissionCeiling);
	if (permissionCeiling.some((permission) => !link[0].permissionCeiling.includes(permission))) throw new Error("PERMISSION_CEILING_EXPANSION_DENIED");
	const now = input.now ?? new Date();
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(agencyCreatorLinksTable)
			.set({ status: "accepted", permissionCeiling, acceptedBy: actor.session.userId, acceptedAt: now, updatedAt: now })
			.where(and(eq(agencyCreatorLinksTable.id, input.linkId), eq(agencyCreatorLinksTable.status, "proposed")))
			.returning();
		if (!updated) throw new Error("AGENCY_LINK_STATE_CHANGED");
		await tx.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: link[0].creatorOrganizationId, targetType: "agency_creator_link", targetId: input.linkId, action: "agency-link.accept", outcome: "success", correlationId: `agency-link:${input.linkId}:accept`, metadata: { permissionCeiling } });
		return updated;
	});
}

export async function revokeDatabaseAgencyLink(input: { linkId: string; now?: Date }) {
	const link = await db.select().from(agencyCreatorLinksTable).where(eq(agencyCreatorLinksTable.id, input.linkId)).limit(1);
	if (!link[0]) throw new Error("AGENCY_LINK_NOT_FOUND");
	const actor = await requireCreatorOwner(link[0].creatorOrganizationId);
	if (link[0].status === "revoked") return link[0];
	const now = input.now ?? new Date();
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(agencyCreatorLinksTable)
			.set({ status: "revoked", revokedBy: actor.session.userId, revokedAt: now, updatedAt: now })
			.where(and(eq(agencyCreatorLinksTable.id, input.linkId), inArray(agencyCreatorLinksTable.status, ["proposed", "accepted"])))
			.returning();
		if (!updated) throw new Error("AGENCY_LINK_STATE_CHANGED");
		await tx.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: link[0].creatorOrganizationId, targetType: "agency_creator_link", targetId: input.linkId, action: "agency-link.revoke", outcome: "success", correlationId: `agency-link:${input.linkId}:revoke`, metadata: {} });
		return updated;
	});
}

export async function reduceDatabaseAgencyLinkCeiling(input: { linkId: string; permissionCeiling: string[]; now?: Date }) {
	const link = await db.select().from(agencyCreatorLinksTable).where(eq(agencyCreatorLinksTable.id, input.linkId)).limit(1);
	if (!link[0] || link[0].status !== "accepted") throw new Error("ACCEPTED_AGENCY_LINK_REQUIRED");
	const actor = await requireCreatorOwner(link[0].creatorOrganizationId);
	const permissionCeiling = validatedPermissions(input.permissionCeiling);
	if (permissionCeiling.some((permission) => !link[0].permissionCeiling.includes(permission))) throw new Error("PERMISSION_CEILING_EXPANSION_DENIED");
	const now = input.now ?? new Date();
	const [updated] = await db
		.update(agencyCreatorLinksTable)
		.set({ permissionCeiling, updatedAt: now })
		.where(and(eq(agencyCreatorLinksTable.id, input.linkId), eq(agencyCreatorLinksTable.status, "accepted")))
		.returning();
	if (!updated) throw new Error("AGENCY_LINK_STATE_CHANGED");
	await db.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: link[0].creatorOrganizationId, targetType: "agency_creator_link", targetId: input.linkId, action: "agency-link.reduce", outcome: "success", correlationId: `agency-link:${input.linkId}:reduce`, metadata: { permissionCeiling } });
	return updated;
}

export async function resolveDatabaseAgencyPermissions(input: { authUserId: string; agencyOrganizationId: string; creatorOrganizationId: string }) {
	const [membership, link] = await Promise.all([
		db
			.select()
			.from(authMemberTable)
			.where(and(eq(authMemberTable.organizationId, input.agencyOrganizationId), eq(authMemberTable.userId, input.authUserId)))
			.limit(1),
		db
			.select()
			.from(agencyCreatorLinksTable)
			.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, input.agencyOrganizationId), eq(agencyCreatorLinksTable.creatorOrganizationId, input.creatorOrganizationId)))
			.limit(1),
	]);
	if (!membership[0]) return [];
	const role = await db
		.select({ permission: authOrganizationRoleTable.permission })
		.from(authOrganizationRoleTable)
		.where(and(eq(authOrganizationRoleTable.organizationId, input.agencyOrganizationId), eq(authOrganizationRoleTable.role, membership[0].role)))
		.limit(1);
	return resolveAgencyAccess({ membershipActive: true, linkStatus: link[0]?.status ?? null, rolePermissions: parseRolePermissions(membership[0].role, role[0]?.permission), permissionCeiling: link[0]?.permissionCeiling ?? [] });
}

export async function allocateDatabaseAgencyLicense(input: { linkId: string; sourceReference: string; product?: "creator_pro" | "runner"; now?: Date }) {
	const actor = await requireAgencyMember("agency:allocate-license");
	const now = input.now ?? new Date();
	const product = input.product ?? "creator_pro";
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT ${agencyAccountsTable.organizationId} FROM ${agencyAccountsTable} WHERE ${agencyAccountsTable.organizationId} = ${actor.account.organizationId} FOR UPDATE`);
		const link = await tx
			.select()
			.from(agencyCreatorLinksTable)
			.where(and(eq(agencyCreatorLinksTable.id, input.linkId), eq(agencyCreatorLinksTable.agencyOrganizationId, actor.account.organizationId), eq(agencyCreatorLinksTable.status, "accepted")))
			.limit(1);
		if (!link[0]) throw new Error("ACCEPTED_AGENCY_LINK_REQUIRED");
		const occupied = await tx
			.select({ id: agencyLicenseAllocationsTable.id })
			.from(agencyLicenseAllocationsTable)
			.innerJoin(agencyCreatorLinksTable, eq(agencyLicenseAllocationsTable.linkId, agencyCreatorLinksTable.id))
			.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, actor.account.organizationId), eq(agencyLicenseAllocationsTable.product, product), inArray(agencyLicenseAllocationsTable.status, ["active", "removal_scheduled"])));
		const seatLimit = product === "runner" ? actor.account.runnerSeatLimit : actor.account.creatorSeatLimit;
		if (occupied.length >= seatLimit) throw new Error(product === "runner" ? "NO_AGENCY_RUNNER_SEAT_AVAILABLE" : "NO_AGENCY_SEAT_AVAILABLE");
		const creator = await tx.select({ creatorId: creatorAccountsTable.creatorId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, link[0].creatorOrganizationId)).limit(1);
		if (!creator[0]) throw new Error("CREATOR_ACCOUNT_NOT_FOUND");
		const id = randomUUID();
		const [allocation] = await tx.insert(agencyLicenseAllocationsTable).values({ id, linkId: input.linkId, creatorId: creator[0].creatorId, status: "active", product, effectiveAt: now, sourceReference: input.sourceReference, createdAt: now, updatedAt: now }).returning();
		const recipient = await tx.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, creator[0].creatorId)).limit(1);
		if (recipient[0]?.email) {
			const intent = buildAgencyAllocationGrantIntent({ allocationId: id, recipient: recipient[0].email, agencyName: actor.account.organizationId, effectiveAt: now });
			await tx.insert(notificationOutboxTable).values({ eventType: "agency-allocation", recipient: intent.recipient, authorityOrganizationId: actor.account.organizationId, templateVersion: intent.templateVersion, locale: "en", payload: { ...intent.payload, boundary: intent.boundary }, scheduledAt: intent.scheduledAt, dedupeKey: intent.dedupeKey });
		}
		await tx.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: actor.account.organizationId, targetType: "agency_license_allocation", targetId: id, action: "allocation.grant", outcome: "success", correlationId: `allocation:${id}:grant`, metadata: { creatorId: creator[0].creatorId } });
		return allocation;
	});
}

export async function scheduleDatabaseAgencyLicenseRemoval(input: { allocationId: string; now?: Date }) {
	const actor = await requireAgencyMember("agency:revoke-license");
	const now = input.now ?? new Date();
	const endsAt = new Date(now.getTime() + SEVEN_DAYS_MS);
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ allocation: agencyLicenseAllocationsTable, link: agencyCreatorLinksTable })
			.from(agencyLicenseAllocationsTable)
			.innerJoin(agencyCreatorLinksTable, eq(agencyLicenseAllocationsTable.linkId, agencyCreatorLinksTable.id))
			.where(and(eq(agencyLicenseAllocationsTable.id, input.allocationId), eq(agencyCreatorLinksTable.agencyOrganizationId, actor.account.organizationId)))
			.limit(1);
		if (!rows[0] || rows[0].allocation.status !== "active") throw new Error("ACTIVE_ALLOCATION_REQUIRED");
		const [updated] = await tx
			.update(agencyLicenseAllocationsTable)
			.set({ status: "removal_scheduled", removalRequestedAt: now, endsAt, updatedAt: now })
			.where(and(eq(agencyLicenseAllocationsTable.id, input.allocationId), eq(agencyLicenseAllocationsTable.status, "active")))
			.returning();
		if (!updated) throw new Error("ALLOCATION_STATE_CHANGED");
		const recipient = await tx.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, rows[0].allocation.creatorId)).limit(1);
		if (recipient[0]?.email) {
			const intents = buildAgencyAllocationRemovalIntents({ allocationId: input.allocationId, recipient: recipient[0].email, agencyName: actor.account.organizationId, requestedAt: now, endsAt });
			await tx.insert(notificationOutboxTable).values(intents.map((intent) => ({ eventType: "agency-allocation", recipient: intent.recipient, authorityOrganizationId: actor.account.organizationId, templateVersion: intent.templateVersion, locale: "en", payload: { ...intent.payload, boundary: intent.boundary }, scheduledAt: intent.scheduledAt, dedupeKey: intent.dedupeKey })));
		}
		await tx.insert(auditEventsTable).values({ actorUserId: actor.session.userId, actorSessionId: actor.session.id, accountOrganizationId: actor.account.organizationId, targetType: "agency_license_allocation", targetId: input.allocationId, action: "allocation.schedule-removal", outcome: "success", correlationId: `allocation:${input.allocationId}:removal`, metadata: { endsAt: endsAt.toISOString() } });
		return updated;
	});
}

export async function listDatabaseAgencyOverview() {
	const actor = await requireAgencyMember("agency:read");
	const links = await db.select().from(agencyCreatorLinksTable).where(eq(agencyCreatorLinksTable.agencyOrganizationId, actor.account.organizationId));
	const allocations = links.length
		? await db
				.select()
				.from(agencyLicenseAllocationsTable)
				.where(
					inArray(
						agencyLicenseAllocationsTable.linkId,
						links.map((link) => link.id),
					),
				)
		: [];
	const billing = await db.select().from(agencyBillingAccountsTable).where(eq(agencyBillingAccountsTable.organizationId, actor.account.organizationId)).limit(1);
	const occupied = allocations.filter((allocation) => allocation.status === "active" || allocation.status === "removal_scheduled");
	return { account: actor.account, billing: billing[0] ?? null, links, allocations, occupiedSeats: occupied.filter((allocation) => allocation.product !== "runner").length, occupiedRunnerSeats: occupied.filter((allocation) => allocation.product === "runner").length };
}

export async function listDatabaseCreatorAgencyLinks() {
	const session = await requireSession();
	const creatorMemberships = await db
		.select({ organizationId: authMemberTable.organizationId })
		.from(authMemberTable)
		.innerJoin(creatorAccountsTable, eq(authMemberTable.organizationId, creatorAccountsTable.organizationId))
		.where(and(eq(authMemberTable.userId, session.userId), eq(authMemberTable.role, "owner")));
	if (!creatorMemberships.length) return [];
	return db
		.select({ link: agencyCreatorLinksTable, agencyName: authOrganizationTable.name })
		.from(agencyCreatorLinksTable)
		.innerJoin(authOrganizationTable, eq(agencyCreatorLinksTable.agencyOrganizationId, authOrganizationTable.id))
		.where(
			inArray(
				agencyCreatorLinksTable.creatorOrganizationId,
				creatorMemberships.map((membership) => membership.organizationId),
			),
		);
}

export async function listDatabaseAdminAgencies() {
	const { validateAuth } = await import("@actions/auth");
	if (!(await validateAuth(true))) throw new Error("ADMIN_REQUIRED");
	return db.select({ account: agencyAccountsTable, name: authOrganizationTable.name, slug: authOrganizationTable.slug }).from(agencyAccountsTable).innerJoin(authOrganizationTable, eq(agencyAccountsTable.organizationId, authOrganizationTable.id));
}

export async function endDueDatabaseAgencyAllocations(input: { now?: Date; limit?: number } = {}) {
	const now = input.now ?? new Date();
	const due = await db
		.select({ id: agencyLicenseAllocationsTable.id })
		.from(agencyLicenseAllocationsTable)
		.where(and(eq(agencyLicenseAllocationsTable.status, "removal_scheduled"), sql`${agencyLicenseAllocationsTable.endsAt} <= ${now}`))
		.limit(Math.max(1, Math.min(input.limit ?? 100, 500)));
	let ended = 0;
	for (const allocation of due) {
		const applied = await db.transaction(async (tx) => {
			const [updated] = await tx
				.update(agencyLicenseAllocationsTable)
				.set({ status: "ended", updatedAt: now })
				.where(and(eq(agencyLicenseAllocationsTable.id, allocation.id), eq(agencyLicenseAllocationsTable.status, "removal_scheduled"), sql`${agencyLicenseAllocationsTable.endsAt} <= ${now}`))
				.returning({ id: agencyLicenseAllocationsTable.id, creatorId: agencyLicenseAllocationsTable.creatorId });
			if (!updated) return false;
			await tx.insert(auditEventsTable).values({ actorSessionId: "agency-allocation-scheduler", targetType: "agency_license_allocation", targetId: updated.id, action: "allocation.end", outcome: "success", correlationId: `allocation:${updated.id}:end`, metadata: { creatorId: updated.creatorId, endedAt: now.toISOString() } });
			return true;
		});
		if (applied) ended += 1;
	}
	return { scanned: due.length, ended };
}
