import "server-only";

import { and, eq } from "drizzle-orm";
import { member as authMemberTable, organizationRole as authOrganizationRoleTable } from "@/db/auth-schema";
import { db } from "@/db/client";
import { agencyCreatorLinksTable, creatorAccountsTable, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { resolveAgencyAccess } from "@/server/agencies/access";
import { authorize, resolveDirectAccessGrant, type AuthorizationDecision } from "./authorize";
import { PERMISSIONS, STANDARD_ROLES, type NonDelegableAction, type Permission } from "./permissions";

type SessionEnvelope = {
	session: {
		id: string;
		userId: string;
		createdAt: Date | string;
		activeOrganizationId?: string | null;
	};
};

function validatedPermissions(values: readonly string[]): Permission[] {
	return [...new Set(values)].filter((permission): permission is Permission => PERMISSIONS.includes(permission as Permission));
}

export function parseOrganizationRolePermissions(role: string, serialized?: string | null): Permission[] {
	if (role === "owner") return [...PERMISSIONS];
	const standardRoleKey = role === "content-manager" ? "contentManager" : role === "billing-manager" ? "billingManager" : role;
	const standard = STANDARD_ROLES[standardRoleKey as keyof typeof STANDARD_ROLES];
	if (standard) return [...standard];
	if (!serialized) return [];
	try {
		const statements = JSON.parse(serialized) as Record<string, unknown>;
		const permissions = Object.entries(statements).flatMap(([resource, actions]) => (Array.isArray(actions) ? actions.filter((action): action is string => typeof action === "string").map((action) => `${resource}:${action}`) : []));
		return validatedPermissions(permissions);
	} catch {
		return [];
	}
}

async function rolePermissions(organizationId: string, role: string) {
	const customRole = await db
		.select({ permission: authOrganizationRoleTable.permission })
		.from(authOrganizationRoleTable)
		.where(and(eq(authOrganizationRoleTable.organizationId, organizationId), eq(authOrganizationRoleTable.role, role)))
		.limit(1);
	return parseOrganizationRolePermissions(role, customRole[0]?.permission);
}

export type CreatorOperationResult =
	| {
			allowed: true;
			accessPath: "owner" | "direct" | "agency";
			authUserId: string;
			sessionId: string;
			creator: typeof usersTable.$inferSelect;
			creatorOrganizationId: string;
	  }
	| { allowed: false; code: Extract<AuthorizationDecision, { allowed: false }>["code"] };

export async function authorizeCreatorOperation(input: { creatorId: string; permission: Permission; resourceOwnerId?: string; requiredEntitlement?: "pro" | "runner"; requireRecentAuth?: boolean; ownerOnlyAction?: NonDelegableAction; now?: Date; requestHeaders?: Headers }): Promise<CreatorOperationResult> {
	const { getAuthSession } = await import("./session");
	const envelope = (await getAuthSession(input.requestHeaders)) as SessionEnvelope | null;
	if (!envelope?.session) return { allowed: false, code: "AUTHENTICATION_REQUIRED" };

	const [accountRows, creatorRows] = await Promise.all([db.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, input.creatorId)).limit(1), db.select().from(usersTable).where(eq(usersTable.id, input.creatorId)).limit(1)]);
	const account = accountRows[0];
	const creator = creatorRows[0];
	if (!account || !creator || creator.disabled) return { allowed: false, code: "ACCOUNT_SUSPENDED" };

	const directMembership = await db
		.select({ role: authMemberTable.role })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, account.organizationId), eq(authMemberTable.userId, envelope.session.userId)))
		.limit(1);

	let access = resolveDirectAccessGrant({ owner: false, activeMember: false, memberPermissions: [], ownerPermissions: STANDARD_ROLES.owner });
	const directRole = directMembership[0]?.role;
	if (directRole) {
		access = resolveDirectAccessGrant({ owner: directRole === "owner", activeMember: true, memberPermissions: await rolePermissions(account.organizationId, directRole), ownerPermissions: STANDARD_ROLES.owner });
	} else if (envelope.session.activeOrganizationId && envelope.session.activeOrganizationId !== account.organizationId) {
		const agencyOrganizationId = envelope.session.activeOrganizationId;
		const [agencyMembership, agencyLink] = await Promise.all([
			db
				.select({ role: authMemberTable.role })
				.from(authMemberTable)
				.where(and(eq(authMemberTable.organizationId, agencyOrganizationId), eq(authMemberTable.userId, envelope.session.userId)))
				.limit(1),
			db
				.select({ status: agencyCreatorLinksTable.status, permissionCeiling: agencyCreatorLinksTable.permissionCeiling })
				.from(agencyCreatorLinksTable)
				.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, agencyOrganizationId), eq(agencyCreatorLinksTable.creatorOrganizationId, account.organizationId)))
				.limit(1),
		]);
		if (agencyMembership[0]) {
			const permissions = resolveAgencyAccess({
				membershipActive: true,
				linkStatus: agencyLink[0]?.status ?? null,
				rolePermissions: await rolePermissions(agencyOrganizationId, agencyMembership[0].role),
				permissionCeiling: agencyLink[0]?.permissionCeiling ?? [],
			});
			if (permissions.length > 0) access = { kind: "agency", permissions, creatorCeiling: agencyLink[0]?.permissionCeiling ?? [] };
		}
	}

	const entitlements = await resolveUserEntitlements(creator);
	const entitlementNames = [entitlements.proAccess ? "pro" : null, entitlements.runnerAccess ? "runner" : null].filter((value): value is string => value !== null);
	const now = input.now ?? new Date();
	const decision = authorize({
		session: { userId: envelope.session.userId, authenticatedAt: envelope.session.createdAt instanceof Date ? envelope.session.createdAt : new Date(envelope.session.createdAt) },
		creatorId: account.creatorId,
		lifecycle: account.status,
		resourceOwnerId: input.resourceOwnerId,
		permission: input.permission,
		access,
		entitlements: entitlementNames,
		requiredEntitlement: input.requiredEntitlement,
		requireRecentAuth: input.requireRecentAuth,
		ownerOnlyAction: input.ownerOnlyAction,
		now,
	});
	if (!decision.allowed) return decision;
	return { allowed: true, accessPath: decision.accessPath, authUserId: envelope.session.userId, sessionId: envelope.session.id, creator, creatorOrganizationId: account.organizationId };
}

export async function listAuthorizedCreatorOperations(input: { permission: Permission; requiredEntitlement?: "pro" | "runner"; requestHeaders?: Headers }): Promise<Array<Extract<CreatorOperationResult, { allowed: true }>>> {
	const { getAuthSession } = await import("./session");
	const envelope = (await getAuthSession(input.requestHeaders)) as SessionEnvelope | null;
	if (!envelope?.session) return [];
	const directMemberships = await db.select({ organizationId: authMemberTable.organizationId }).from(authMemberTable).where(eq(authMemberTable.userId, envelope.session.userId));
	const organizationIds = new Set(directMemberships.map((membership) => membership.organizationId));
	if (envelope.session.activeOrganizationId) {
		const linkedCreators = await db
			.select({ creatorOrganizationId: agencyCreatorLinksTable.creatorOrganizationId })
			.from(agencyCreatorLinksTable)
			.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, envelope.session.activeOrganizationId), eq(agencyCreatorLinksTable.status, "accepted")));
		for (const link of linkedCreators) organizationIds.add(link.creatorOrganizationId);
	}
	if (organizationIds.size === 0) return [];
	const accounts = await Promise.all([...organizationIds].map((organizationId) => db.select({ creatorId: creatorAccountsTable.creatorId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, organizationId)).limit(1)));
	const decisions = await Promise.all(accounts.flatMap((rows) => (rows[0] ? [authorizeCreatorOperation({ creatorId: rows[0].creatorId, permission: input.permission, requiredEntitlement: input.requiredEntitlement, requestHeaders: input.requestHeaders })] : [])));
	return decisions.filter((decision): decision is Extract<CreatorOperationResult, { allowed: true }> => decision.allowed);
}
