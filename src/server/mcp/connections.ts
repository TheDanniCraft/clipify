import "server-only";
import { and, eq, or, isNotNull, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient } from "@/db/client";
import { mcpConnectionGrantsTable, mcpGrantCreatorsTable } from "@/db/schema";
import { oauthClient, oauthConsent, oauthRefreshToken, oauthAccessToken } from "@/db/auth-schema";

type SessionAuth = { api: { getSession(input: { headers: Headers }): Promise<{ user: { id: string } } | null> } };
import type { McpConnection } from "@lib/mcpConnection";
export type { McpConnection } from "@lib/mcpConnection";

export async function listMcpConnections(input: { auth: SessionAuth; headers: Headers; client?: DatabaseClient }): Promise<McpConnection[]> {
	const session = await input.auth.api.getSession({ headers: input.headers });
	if (!session) throw new Error("AUTHENTICATION_REQUIRED");
	const client = input.client ?? db;
	const grants = await client.select().from(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.authUserId, session.user.id)).orderBy(mcpConnectionGrantsTable.createdAt);
	return Promise.all(
		grants.map(async (grant) => {
			const [clients, creators] = await Promise.all([client.select({ name: oauthClient.name }).from(oauthClient).where(eq(oauthClient.clientId, grant.clientId)).limit(1), client.select({ creatorId: mcpGrantCreatorsTable.creatorId, scopes: mcpGrantCreatorsTable.scopes }).from(mcpGrantCreatorsTable).where(eq(mcpGrantCreatorsTable.grantId, grant.id))]);
			return {
				id: grant.id,
				clientId: grant.clientId,
				clientName: clients[0]?.name ?? grant.clientId,
				scopes: grant.scopes,
				creatorIds: creators.map((creator) => creator.creatorId),
				creatorPermissions: creators.map((creator) => ({ creatorId: creator.creatorId, scopes: creator.scopes ?? grant.scopes.filter((scope) => scope !== "offline_access") })),
				createdAt: grant.createdAt.toISOString(),
				expiresAt: grant.expiresAt.toISOString(),
				revokedAt: grant.revokedAt?.toISOString() ?? null,
				active: grant.active && !grant.revokedAt && grant.expiresAt > new Date(),
			};
		}),
	);
}

export async function revokeMcpConnection(input: { auth: SessionAuth; headers: Headers; origin: string; grantId: string; client?: DatabaseClient }): Promise<Response> {
	if (input.headers.get("origin") !== new URL(input.origin).origin) return Response.json({ error: "access_denied" }, { status: 403 });
	const session = await input.auth.api.getSession({ headers: input.headers });
	if (!session) return Response.json({ error: "login_required" }, { status: 401 });
	if (!z.uuid().safeParse(input.grantId).success) return Response.json({ error: "invalid_request" }, { status: 400 });
	const client = input.client ?? db;
	let found = false;
	try {
		found = await client.transaction(async (tx) => {
			const [grant] = await tx
				.select()
				.from(mcpConnectionGrantsTable)
				.where(and(eq(mcpConnectionGrantsTable.id, input.grantId), eq(mcpConnectionGrantsTable.authUserId, session.user.id)))
				.limit(1)
				.for("update");
			if (!grant || grant.authUserId !== session.user.id) return false;
			if (!grant.revokedAt) await tx.update(mcpConnectionGrantsTable).set({ revokedAt: new Date(), active: false }).where(eq(mcpConnectionGrantsTable.id, grant.id));
			return true;
		});
	} catch {
		return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
	}
	if (!found) return Response.json({ error: "not_found" }, { status: 404 });
	// Local revocation is durable before provider cleanup. Repeating revoke retries
	// cleanup without restoring authority or affecting another connection.
	try {
		await client.transaction(async (tx) => {
			await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.referenceId, input.grantId));
			await tx.delete(oauthRefreshToken).where(eq(oauthRefreshToken.referenceId, input.grantId));
			await tx.delete(oauthConsent).where(eq(oauthConsent.referenceId, input.grantId));
		});
		return Response.json({ revoked: true, cleanupPending: false });
	} catch {
		return Response.json({ revoked: true, cleanupPending: true });
	}
}

export async function purgeInactiveMcpConnections(input: { auth: SessionAuth; headers: Headers; origin: string; grantId?: string; client?: DatabaseClient }): Promise<Response> {
	if (input.headers.get("origin") !== new URL(input.origin).origin) return Response.json({ error: "access_denied" }, { status: 403 });
	const session = await input.auth.api.getSession({ headers: input.headers });
	if (!session) return Response.json({ error: "login_required" }, { status: 401 });
	if (input.grantId !== undefined && !z.uuid().safeParse(input.grantId).success) return Response.json({ error: "invalid_request" }, { status: 400 });
	const client = input.client ?? db;
	try {
		const purgedIds = await client.transaction(async (tx) => {
			const grants = await tx
				.select({ id: mcpConnectionGrantsTable.id })
				.from(mcpConnectionGrantsTable)
				.where(and(eq(mcpConnectionGrantsTable.authUserId, session.user.id), input.grantId === undefined ? undefined : eq(mcpConnectionGrantsTable.id, input.grantId), or(eq(mcpConnectionGrantsTable.active, false), isNotNull(mcpConnectionGrantsTable.revokedAt), lte(mcpConnectionGrantsTable.expiresAt, new Date()))))
				.orderBy(mcpConnectionGrantsTable.id)
				.for("update");
			const ids = grants.map((grant) => grant.id);
			if (!ids.length) return ids;
			await tx.delete(oauthAccessToken).where(inArray(oauthAccessToken.referenceId, ids));
			await tx.delete(oauthRefreshToken).where(inArray(oauthRefreshToken.referenceId, ids));
			await tx.delete(oauthConsent).where(inArray(oauthConsent.referenceId, ids));
			await tx.delete(mcpConnectionGrantsTable).where(inArray(mcpConnectionGrantsTable.id, ids));
			return ids;
		});
		return Response.json({ purgedIds });
	} catch {
		return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
	}
}
