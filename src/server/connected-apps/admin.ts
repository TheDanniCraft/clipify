import "server-only";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { connectionInput } from "./admin-input";
import { oauthClient } from "@/db/auth-schema";
import { db } from "@/db/client";
import { auth } from "@/auth/config";
import { captureUnexpectedError } from "@/app/lib/sentryServer";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { connectedAppGrantsTable, creatorAccountsTable, creatorIdentityLinksTable, usersTable, auditEventsTable } from "@/db/schema";
import { requireConnectedAppAdmin, connectedAppResource, CONNECTED_APP_SCOPE } from "./oauth-policy";
import { readConnectedAppJson, connectedAppFailure } from "./http";
import { ConnectedAppError } from "./grants";
export async function handleConnectedAppAdminRequest(request: Request): Promise<Response> {
	try {
		const origin = resolveBaseUrl().origin;
		if (request.headers.get("origin") !== origin) throw new ConnectedAppError("ACCESS_DENIED");
		let actor: Awaited<ReturnType<typeof requireConnectedAppAdmin>>;
		try {
			actor = await requireConnectedAppAdmin(request.headers, true);
		} catch (error) {
			if (error instanceof Error && error.message === "RECENT_AUTH_REQUIRED") throw new ConnectedAppError("RECENT_AUTH_REQUIRED", 401);
			throw new ConnectedAppError("ACCESS_DENIED");
		}
		const parsed = connectionInput.safeParse(await readConnectedAppJson(request));
		if (!parsed.success) throw new ConnectedAppError("INVALID_INPUT", 400);
		const input = parsed.data;
		if (input.action === "revoke") {
			await db.transaction(async (tx) => {
				const [grant] = await tx.update(connectedAppGrantsTable).set({ revokedAt: new Date() }).where(eq(connectedAppGrantsTable.id, input.grantId)).returning();
				if (!grant) throw new ConnectedAppError("NOT_FOUND", 404);
				const [client] = await tx.select({ metadata: oauthClient.metadata }).from(oauthClient).where(eq(oauthClient.clientId, grant.clientId)).limit(1);
				const linked = (client?.metadata as { connectedAppIdentityClientId?: string } | null)?.connectedAppIdentityClientId;
				await tx
					.update(oauthClient)
					.set({ disabled: true })
					.where(inArray(oauthClient.clientId, [grant.clientId, ...(linked ? [linked] : [])]));
				await tx.insert(auditEventsTable).values({ actorUserId: actor.authUserId, actorSessionId: actor.sessionId, targetType: "connected_application", targetId: grant.id, action: "connected-app.revoke", outcome: "success", correlationId: randomUUID(), metadata: { clientId: grant.clientId, creatorId: grant.creatorId } });
			});
			return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
		}
		const expiresAt = new Date(input.expiresAt);
		const now = Date.now();
		if (expiresAt.getTime() <= now || expiresAt.getTime() > now + 90 * 86400000) throw new ConnectedAppError("INVALID_INPUT", 400);
		const [creator] = await db.select({ id: usersTable.id, disabled: usersTable.disabled, status: creatorAccountsTable.status, subject: creatorIdentityLinksTable.authUserId }).from(usersTable).innerJoin(creatorAccountsTable, eq(creatorAccountsTable.creatorId, usersTable.id)).leftJoin(creatorIdentityLinksTable, eq(creatorIdentityLinksTable.creatorId, usersTable.id)).where(eq(usersTable.id, input.creatorId)).limit(1);
		if (!creator || creator.disabled || creator.status !== "active" || (input.callbackUrl && !creator.subject)) throw new ConnectedAppError("ACCESS_DENIED");
		// The provider validates and hashes secrets; never write raw credentials to storage.
		const provider = auth.api as typeof auth.api & {
			adminCreateOAuthClient(input: { headers: Headers; body: { client_name: string; token_endpoint_auth_method: "client_secret_basic"; grant_types: string[]; scope: string; client_credentials_scopes?: string[]; resources: string[]; redirect_uris?: string[]; response_types?: string[]; require_pkce?: boolean } }): Promise<{ client_id: string; client_secret?: string }>;
			adminDeleteOAuthClient(input: { headers: Headers; body: { client_id: string } }): Promise<unknown>;
		};
		const issued: string[] = [];
		const issue = async (body: Parameters<typeof provider.adminCreateOAuthClient>[0]["body"]) => {
			const client = await provider.adminCreateOAuthClient({ headers: request.headers, body });
			if (client.client_id) issued.push(client.client_id);
			if (!client.client_id || !client.client_secret) throw new ConnectedAppError("SERVICE_UNAVAILABLE", 503);
			return { clientId: client.client_id, clientSecret: client.client_secret };
		};
		let created: { clientId: string; clientSecret: string };
		let identity: { clientId: string; clientSecret: string } | undefined;

		let grantId: string;
		try {
			const shared = { token_endpoint_auth_method: "client_secret_basic" as const };
			created = await issue({ ...shared, client_name: input.name, grant_types: ["client_credentials"], scope: CONNECTED_APP_SCOPE, client_credentials_scopes: [CONNECTED_APP_SCOPE], resources: [connectedAppResource(origin)] });
			if (input.callbackUrl) identity = await issue({ ...shared, client_name: `${input.name} sign-in`, grant_types: ["authorization_code"], scope: "openid profile email", resources: [`${origin}/api/auth/oauth2/userinfo`], redirect_uris: [input.callbackUrl], response_types: ["code"], require_pkce: true });
			grantId = await db.transaction(async (tx) => {
				const [grant] = await tx.insert(connectedAppGrantsTable).values({ clientId: created.clientId, creatorId: input.creatorId, operations: input.operations, expiresAt, provisionedBy: actor.authUserId }).returning();
				if (identity)
					await tx
						.update(oauthClient)
						.set({ metadata: sql`coalesce(${oauthClient.metadata}, '{}'::jsonb) || ${JSON.stringify({ connectedAppIdentityClientId: identity.clientId })}::jsonb` })
						.where(eq(oauthClient.clientId, created.clientId));
				await tx.insert(auditEventsTable).values({ actorUserId: actor.authUserId, actorSessionId: actor.sessionId, targetType: "connected_application", targetId: grant.id, action: "connected-app.provision", outcome: "success", correlationId: randomUUID(), metadata: { clientId: created.clientId, creatorId: input.creatorId } });
				return grant.id;
			});
		} catch (error) {
			for (const clientId of issued) {
				try {
					await provider.adminDeleteOAuthClient({ headers: request.headers, body: { client_id: clientId } });
				} catch {
					captureUnexpectedError(new Error("Connected application provisioning cleanup failed"), "connected-apps", "cleanup-client");
				}
			}
			throw error;
		}
		return Response.json({ ok: true, data: { grantId, clientId: created.clientId, clientSecret: created.clientSecret, creatorId: input.creatorId, expiresAt: expiresAt.toISOString(), ...(identity ? { identity, callbackUrl: input.callbackUrl, creatorSubject: creator.subject } : {}) } }, { status: 201, headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return connectedAppFailure(error);
	}
}
