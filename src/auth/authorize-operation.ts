import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { member as authMemberTable, organizationRole as authOrganizationRoleTable } from "@/db/auth-schema";
import { db, type QueryClient } from "@/db/client";
import { agencyCreatorLinksTable, creatorAccountsTable, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { resolveAgencyAccess } from "@/server/agencies/access";
import { authorize, resolveDirectAccessGrant, type AuthorizationDecision } from "./authorize";
import { PERMISSIONS, STANDARD_ROLES, type NonDelegableAction, type Permission } from "./permissions";

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

async function rolePermissions(organizationId: string, role: string, client: QueryClient = db) {
	const standard = parseOrganizationRolePermissions(role);
	if (standard.length) return standard;
	const customRole = await client
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

export type TrustedCreatorPrincipal = {
	kind: "session" | "oauth";
	authUserId: string;
	authenticatedAt: Date;
	sessionId?: string;
	organizationId?: string | null;
	clientId?: string;
	grantId?: string;
	generation?: number;
	tokenExpiresAt?: Date;
	resource?: string;
	issuer?: string;
	scopes?: readonly string[];
	creators?: readonly { creatorId: string; agencyOrganizationId: string | null; scopes?: readonly string[] }[];
};

export async function authorizeCreatorOperation(input: { creatorId: string; permission: Permission; resourceOwnerId?: string; requiredEntitlement?: "pro" | "runner"; requireRecentAuth?: boolean; ownerOnlyAction?: NonDelegableAction; now?: Date; requestHeaders?: Headers }): Promise<CreatorOperationResult> {
	const { getVerifiedSessionPrincipal } = await import("./session-principal");
	const principal = await getVerifiedSessionPrincipal(input.requestHeaders);
	if (!principal) return { allowed: false, code: "AUTHENTICATION_REQUIRED" };
	return authorizeTrustedCreatorOperation({ ...input, principal });
}

export async function authorizeTrustedCreatorOperation(input: { creatorId: string; permission: Permission; permissions?: readonly Permission[]; resourceOwnerId?: string; requiredEntitlement?: "pro" | "runner"; requireRecentAuth?: boolean; ownerOnlyAction?: NonDelegableAction; now?: Date; requestHeaders?: Headers } & { principal: TrustedCreatorPrincipal; client?: QueryClient }): Promise<CreatorOperationResult> {
	const { principal } = input;
	// One request-local authority snapshot can check every selected consent scope.
	const permissions = [...new Set([input.permission, ...(input.permissions ?? [])])];
	const client = input.client ?? db;
	let organizationId = principal.organizationId;
	if (principal.kind === "oauth") {
		const target = principal.creators?.find((creator) => creator.creatorId === input.creatorId);
		if (!target) return { allowed: false, code: "ACCESS_PATH_REQUIRED" };
		if (permissions.some((permission) => !principal.scopes?.includes(permission) || (target.scopes && !target.scopes.includes(permission)))) return { allowed: false, code: "PERMISSION_DENIED" };
		organizationId = target.agencyOrganizationId;
	}

	const [accountRows, creatorRows] = await Promise.all([client.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, input.creatorId)).limit(1), client.select().from(usersTable).where(eq(usersTable.id, input.creatorId)).limit(1)]);
	const account = accountRows[0];
	const creator = creatorRows[0];
	if (!account || !creator || creator.disabled) return { allowed: false, code: "ACCOUNT_SUSPENDED" };

	const directMembership = await client
		.select({ role: authMemberTable.role })
		.from(authMemberTable)
		.where(and(eq(authMemberTable.organizationId, account.organizationId), eq(authMemberTable.userId, principal.authUserId)))
		.limit(1);

	async function resolveCreatorAccessPath() {
		let access = resolveDirectAccessGrant({ owner: false, activeMember: false, memberPermissions: [], ownerPermissions: STANDARD_ROLES.owner });
		const directRole = directMembership[0]?.role;
		if (directRole) {
			access = resolveDirectAccessGrant({ owner: directRole === "owner", activeMember: true, memberPermissions: await rolePermissions(account.organizationId, directRole, client), ownerPermissions: STANDARD_ROLES.owner });
		} else if (organizationId && organizationId !== account.organizationId) {
			const agencyOrganizationId = organizationId;
			const [agencyMembership, agencyLink] = await Promise.all([
				client
					.select({ role: authMemberTable.role })
					.from(authMemberTable)
					.where(and(eq(authMemberTable.organizationId, agencyOrganizationId), eq(authMemberTable.userId, principal.authUserId)))
					.limit(1),
				client
					.select({ status: agencyCreatorLinksTable.status, permissionCeiling: agencyCreatorLinksTable.permissionCeiling })
					.from(agencyCreatorLinksTable)
					.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, agencyOrganizationId), eq(agencyCreatorLinksTable.creatorOrganizationId, account.organizationId)))
					.limit(1),
			]);
			if (agencyMembership[0]) {
				const permissions = resolveAgencyAccess({
					membershipActive: true,
					linkStatus: agencyLink[0]?.status ?? null,
					rolePermissions: await rolePermissions(agencyOrganizationId, agencyMembership[0].role, client),
					permissionCeiling: agencyLink[0]?.permissionCeiling ?? [],
				});
				if (permissions.length > 0) access = { kind: "agency", permissions, creatorCeiling: agencyLink[0]?.permissionCeiling ?? [] };
			}
		}
		return { access };
	}
	const { access } = await resolveCreatorAccessPath();

	const entitlements = await resolveUserEntitlements(creator, client);
	const entitlementNames = [entitlements.proAccess ? "pro" : null, entitlements.runnerAccess ? "runner" : null].filter((value): value is string => value !== null);
	const now = input.now ?? new Date();
	const decisions = permissions.map((permission) =>
		authorize({
			session: { userId: principal.authUserId, authenticatedAt: principal.authenticatedAt },
			creatorId: account.creatorId,
			lifecycle: account.status,
			resourceOwnerId: input.resourceOwnerId,
			permission,
			access,
			entitlements: entitlementNames,
			// Direct team membership is a creator Pro capability. Owners always retain
			// access to their own account, while agency access follows the separately
			// contracted agency/allocation path.
			requiredEntitlement: input.requiredEntitlement ?? (access.kind === "direct" ? "pro" : undefined),
			requireRecentAuth: input.requireRecentAuth,
			ownerOnlyAction: input.ownerOnlyAction,
			now,
		}),
	);
	const denied = decisions.find((decision) => !decision.allowed);
	if (denied) return denied;
	const decision = decisions[0];
	if (!decision.allowed) return decision;
	return { allowed: true, accessPath: decision.accessPath, authUserId: principal.authUserId, sessionId: principal.sessionId ?? "", creator, creatorOrganizationId: account.organizationId };
}

export async function listAuthorizedCreatorOperations(input: { permission: Permission; requiredEntitlement?: "pro" | "runner"; requestHeaders?: Headers; principal?: TrustedCreatorPrincipal & { kind: "session" } }): Promise<Array<Extract<CreatorOperationResult, { allowed: true }>>> {
	const { getVerifiedSessionPrincipal } = await import("./session-principal");
	const principal = input.principal ?? (await getVerifiedSessionPrincipal(input.requestHeaders));
	if (!principal || !Number.isFinite(principal.authenticatedAt.getTime())) return [];
	const directMemberships = await db.select({ organizationId: authMemberTable.organizationId }).from(authMemberTable).where(eq(authMemberTable.userId, principal.authUserId));
	const organizationIds = new Set(directMemberships.map((membership) => membership.organizationId));
	if (principal.organizationId) {
		const linkedCreators = await db
			.select({ creatorOrganizationId: agencyCreatorLinksTable.creatorOrganizationId })
			.from(agencyCreatorLinksTable)
			.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, principal.organizationId), eq(agencyCreatorLinksTable.status, "accepted")));
		for (const link of linkedCreators) organizationIds.add(link.creatorOrganizationId);
	}
	if (organizationIds.size === 0) return [];
	const accounts = await db
		.select({ creatorId: creatorAccountsTable.creatorId, organizationId: creatorAccountsTable.organizationId })
		.from(creatorAccountsTable)
		.where(inArray(creatorAccountsTable.organizationId, [...organizationIds]));
	const byOrganization = new Map(accounts.map((account) => [account.organizationId, account.creatorId]));
	const creatorIds = [...organizationIds].map((organizationId) => byOrganization.get(organizationId)).filter((id): id is string => Boolean(id));
	const decisions = await Promise.all(creatorIds.map((creatorId) => authorizeTrustedCreatorOperation({ principal, creatorId, permission: input.permission, requiredEntitlement: input.requiredEntitlement })));
	return decisions.filter((decision): decision is Extract<CreatorOperationResult, { allowed: true }> => decision.allowed);
}
