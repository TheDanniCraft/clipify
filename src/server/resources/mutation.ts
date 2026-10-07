import "server-only";
import { lockOwnerProEntitlements } from "./entitlement-lock";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";
import { creatorAccountsTable, mcpConnectionGrantsTable, usersTable, agencyCreatorLinksTable } from "@/db/schema";
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { member as authMemberTable, organizationRole as authOrganizationRoleTable } from "@/db/auth-schema";
import type { Permission } from "@/auth/permissions";

/** Transaction lock order: OAuth grant, creator lifecycle, owner policy, membership, role, agency link, Pro entitlement rows, then resources. */
export async function authorizeLockedMutation(principal: TrustedCreatorPrincipal, creatorId: string, permission: Permission, client: TransactionClient, testNow?: Date) {
	let grantExpiresAt: Date | undefined;
	if (principal.kind === "oauth") {
		if (!principal.grantId) throw new Error("AUTHENTICATION_REQUIRED");
		const [grant] = await client.select().from(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.id, principal.grantId)).limit(1).for("update");
		const now = testNow ?? new Date();
		if (!grant || !grant.active || grant.revokedAt || grant.expiresAt <= now || !principal.tokenExpiresAt || principal.tokenExpiresAt <= now || grant.authUserId !== principal.authUserId || grant.clientId !== principal.clientId || grant.generation !== principal.generation || grant.resource !== principal.resource || grant.issuer !== principal.issuer || !principal.scopes?.length || principal.scopes.some((scope) => !grant.scopes.includes(scope))) throw new Error("AUTHENTICATION_REQUIRED");
		grantExpiresAt = grant.expiresAt;
	}
	const [account] = await client.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId)).limit(1).for("update");
	// Native plan/disable writers update this row and therefore share its transaction lock.
	await client.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, creatorId)).limit(1).for("update");
	const agencyOrganizationId = principal.kind === "oauth" ? principal.creators?.find((target) => target.creatorId === creatorId)?.agencyOrganizationId : principal.organizationId;
	const organizations = [...new Set([account?.organizationId, agencyOrganizationId].filter((id): id is string => typeof id === "string" && id.length > 0))];
	if (organizations.length) {
		// Role updates/removal take native row locks; hold these permissions through resource commit.
		const members = await client
			.select({ id: authMemberTable.id, role: authMemberTable.role, organizationId: authMemberTable.organizationId })
			.from(authMemberTable)
			.where(and(eq(authMemberTable.userId, principal.authUserId), inArray(authMemberTable.organizationId, organizations)))
			.orderBy(asc(authMemberTable.id))
			.for("share");
		if (members.length) {
			await client
				.select({ id: authOrganizationRoleTable.id })
				.from(authOrganizationRoleTable)
				.where(or(...members.map((member) => and(eq(authOrganizationRoleTable.organizationId, member.organizationId), eq(authOrganizationRoleTable.role, member.role)))))
				.orderBy(asc(authOrganizationRoleTable.id))
				.for("share");
		}
	}

	if (account && agencyOrganizationId && agencyOrganizationId !== account.organizationId) {
		await client
			.select({ id: agencyCreatorLinksTable.id })
			.from(agencyCreatorLinksTable)
			.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, agencyOrganizationId), eq(agencyCreatorLinksTable.creatorOrganizationId, account.organizationId)))
			.orderBy(asc(agencyCreatorLinksTable.id))
			.for("share");
	}
	await lockOwnerProEntitlements(creatorId, client);
	const now = testNow ?? new Date();
	// Waiting for the creator lock can also outlast the token; never use entry time.
	if (principal.kind === "oauth" && (!principal.tokenExpiresAt || principal.tokenExpiresAt <= now || !grantExpiresAt || grantExpiresAt <= now)) throw new Error("AUTHENTICATION_REQUIRED");
	const decision = await authorizeTrustedCreatorOperation({ principal, creatorId, permission, client, now });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	return {
		...decision,
		// The grant row remains locked, but its clock deadline can pass during later resource waits.
		assertAuthorityCurrent() {
			const current = new Date();
			if (principal.kind === "oauth" && (!principal.tokenExpiresAt || principal.tokenExpiresAt <= current || !grantExpiresAt || grantExpiresAt <= current)) throw new Error("AUTHENTICATION_REQUIRED");
		},
	};
}
