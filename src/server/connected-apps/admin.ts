import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auth } from "@/auth/config";
import { captureUnexpectedError } from "@/app/lib/sentryServer";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { connectedAppGrantsTable, creatorAccountsTable, usersTable, auditEventsTable } from "@/db/schema";
import { requireConnectedAppAdmin, connectedAppResource, CONNECTED_APP_SCOPE } from "./oauth-policy";
import { readConnectedAppJson, connectedAppFailure } from "./http";
import { ConnectedAppError } from "./grants";
const inputSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("provision"), name: z.string().trim().min(1).max(80), creatorId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), expiresAt: z.iso.datetime() }).strict(), z.object({ action: z.literal("revoke"), grantId: z.uuid() }).strict()]);
export async function handleConnectedAppAdminRequest(request: Request): Promise<Response> {
	try {
		const origin = resolveBaseUrl().origin;
		if (request.headers.get("origin") !== origin) throw new ConnectedAppError("ACCESS_DENIED");
		let actor: Awaited<ReturnType<typeof requireConnectedAppAdmin>>;
		try {
			actor = await requireConnectedAppAdmin(request.headers);
		} catch {
			throw new ConnectedAppError("ACCESS_DENIED");
		}
		const parsed = inputSchema.safeParse(await readConnectedAppJson(request));
		if (!parsed.success) throw new ConnectedAppError("INVALID_INPUT", 400);
		const input = parsed.data;
		if (input.action === "revoke") {
			await db.transaction(async (tx) => {
				const [grant] = await tx.update(connectedAppGrantsTable).set({ revokedAt: new Date() }).where(eq(connectedAppGrantsTable.id, input.grantId)).returning();
				if (!grant) throw new ConnectedAppError("NOT_FOUND", 404);
				await tx.insert(auditEventsTable).values({ actorUserId: actor.authUserId, actorSessionId: actor.sessionId, targetType: "connected_application", targetId: grant.id, action: "connected-app.revoke", outcome: "success", correlationId: randomUUID(), metadata: { clientId: grant.clientId, creatorId: grant.creatorId } });
			});
			return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
		}
		const expiresAt = new Date(input.expiresAt);
		const now = Date.now();
		if (expiresAt.getTime() <= now || expiresAt.getTime() > now + 90 * 86400000) throw new ConnectedAppError("INVALID_INPUT", 400);
		const [creator] = await db.select({ id: usersTable.id, disabled: usersTable.disabled, status: creatorAccountsTable.status }).from(usersTable).innerJoin(creatorAccountsTable, eq(creatorAccountsTable.creatorId, usersTable.id)).where(eq(usersTable.id, input.creatorId)).limit(1);
		if (!creator || creator.disabled || creator.status !== "active") throw new ConnectedAppError("ACCESS_DENIED");
		// Plugin arrays erase provider endpoint types; the installed provider owns this API.
		const provider = auth.api as typeof auth.api & { adminCreateOAuthClient(input: { headers: Headers; body: { client_name: string; token_endpoint_auth_method: "client_secret_basic"; grant_types: string[]; scope: string; client_credentials_scopes: string[]; resources: string[] } }): Promise<{ client_id: string; client_secret?: string }>; adminDeleteOAuthClient(input: { headers: Headers; body: { client_id: string } }): Promise<unknown> };
		const created = await provider.adminCreateOAuthClient({ headers: request.headers, body: { client_name: input.name, token_endpoint_auth_method: "client_secret_basic", grant_types: ["client_credentials"], scope: CONNECTED_APP_SCOPE, client_credentials_scopes: [CONNECTED_APP_SCOPE], resources: [connectedAppResource(origin)] } });
		if (!created.client_id || !created.client_secret) throw new ConnectedAppError("SERVICE_UNAVAILABLE", 503);
		let grantId: string;
		try {
			grantId = await db.transaction(async (tx) => {
				const [grant] = await tx
					.insert(connectedAppGrantsTable)
					.values({ clientId: created.client_id, creatorId: input.creatorId, operations: ["search_clips"], expiresAt, provisionedBy: actor.authUserId })
					.returning();
				await tx.insert(auditEventsTable).values({ actorUserId: actor.authUserId, actorSessionId: actor.sessionId, targetType: "connected_application", targetId: grant.id, action: "connected-app.provision", outcome: "success", correlationId: randomUUID(), metadata: { clientId: created.client_id, creatorId: input.creatorId } });
				return grant.id;
			});
		} catch (error) {
			try {
				await provider.adminDeleteOAuthClient({ headers: request.headers, body: { client_id: created.client_id } });
			} catch {
				captureUnexpectedError(new Error("Connected application provisioning cleanup failed"), "connected-apps", "cleanup-client");
			}
			throw error;
		}
		return Response.json({ ok: true, data: { grantId, clientId: created.client_id, clientSecret: created.client_secret, creatorId: input.creatorId, expiresAt: expiresAt.toISOString() } }, { status: 201, headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return connectedAppFailure(error);
	}
}
