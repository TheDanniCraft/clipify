import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { oauthClient } from "@/db/auth-schema";
import { connectedAppGrantsTable as grants, creatorAccountsTable, usersTable, auditEventsTable } from "@/db/schema";
import { consumeMcpRateLimit } from "@/server/mcp/rate-limit";
import { assertConnectedAppGrant, ConnectedAppError } from "./grants";

type Identity = { clientId: string; creatorId: string; operation: string };
export async function withConnectedAppGrant<T>(identity: Identity, run: (grant: { id: string }) => Promise<T>): Promise<T> {
	const grant = await db.transaction(async (tx) => {
		const grant = await readGrant(tx, identity);
		assertConnectedAppGrant(grant, identity);
		return { id: grant.id };
	});
	const budget = await consumeMcpRateLimit({ kind: "call", network: `application:${grant.id}`, authUserId: `application:${grant.id}`, clientId: identity.clientId });
	if (!budget.allowed) throw new ConnectedAppError("RATE_LIMITED", 429);
	const result = await run(grant);
	return db.transaction(async (tx) => {
		assertConnectedAppGrant(await readGrant(tx, identity), identity);
		const auditId = randomUUID();
		await tx.insert(auditEventsTable).values({ id: auditId, actorUserId: null, targetType: "connected_application", targetId: grant.id, action: `connected-app.${identity.operation}`, outcome: "success", correlationId: auditId, metadata: { ...identity, grantId: grant.id } });
		return result;
	});
}

async function readGrant(tx: TransactionClient, identity: Identity) {
	const [grant] = await tx
		.select({ id: grants.id, clientId: grants.clientId, creatorId: grants.creatorId, operations: grants.operations, expiresAt: grants.expiresAt, revokedAt: grants.revokedAt, clientDisabled: oauthClient.disabled, creatorDisabled: usersTable.disabled, creatorStatus: creatorAccountsTable.status })
		.from(grants)
		.innerJoin(oauthClient, eq(oauthClient.clientId, grants.clientId))
		.innerJoin(usersTable, eq(usersTable.id, grants.creatorId))
		.innerJoin(creatorAccountsTable, eq(creatorAccountsTable.creatorId, grants.creatorId))
		.where(and(eq(grants.clientId, identity.clientId), eq(grants.creatorId, identity.creatorId)))
		.limit(1)
		.for("share", { of: grants });
	return grant;
}

export async function exportConnectedAppGrants(creatorId: string) {
	return db.select({ id: grants.id, clientId: grants.clientId, creatorId: grants.creatorId, operations: grants.operations, expiresAt: grants.expiresAt, revokedAt: grants.revokedAt, createdAt: grants.createdAt }).from(grants).where(eq(grants.creatorId, creatorId));
}
