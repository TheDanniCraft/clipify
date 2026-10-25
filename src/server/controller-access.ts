import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { session as authSessionTable } from "@/db/auth-schema";
import { db } from "@/db/client";
import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";

export type ControllerIdentity = { authUserId: string; sessionId: string; expiresAt: number };

export async function hasCurrentControllerAccess(ownerId: string, identity: ControllerIdentity) {
	if (!identity.authUserId || !identity.sessionId || !Number.isFinite(identity.expiresAt) || identity.expiresAt <= Date.now()) return false;
	const [session] = await db
		.select({ userId: authSessionTable.userId, createdAt: authSessionTable.createdAt, activeOrganizationId: authSessionTable.activeOrganizationId })
		.from(authSessionTable)
		.where(and(eq(authSessionTable.id, identity.sessionId), eq(authSessionTable.userId, identity.authUserId), gt(authSessionTable.expiresAt, new Date())))
		.limit(1);
	if (!session) return false;
	const decision = await authorizeTrustedCreatorOperation({
		creatorId: ownerId,
		resourceOwnerId: ownerId,
		permission: "overlay:control",
		requiredEntitlement: "pro",
		principal: { kind: "session", authUserId: identity.authUserId, sessionId: identity.sessionId, authenticatedAt: session.createdAt, organizationId: session.activeOrganizationId },
	});
	return decision.allowed;
}
