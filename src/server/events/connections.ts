import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, dbPool, type DatabaseClient } from "@/db/client";
import { eventConnectionsTable as connections, eventConnectionIntentsTable as intents, awardAssetsTable } from "@/db/schema";
import { account as accounts, session as sessions } from "@/db/auth-schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { EventError, eventError } from "./persistence";
import { safeReturnPath } from "@/auth/return-url";
import { resolveBaseUrl } from "@lib/baseUrl";
import { withSerializedProviderCredential } from "@/server/provider-credentials";
import { encryptString, decryptString } from "@lib/encryption";
import { s3CredentialsSchema, s3Request } from "./storage-http";
import { fetchStreamingChannel, requestProviderJson } from "@/server/runner/provider-api";
import { eventGoogleProviderIds } from "@/auth/google-connections";
export type EventGoogleProvider = "drive" | "youtube";
export const eventGoogleScope = (provider: EventGoogleProvider) => (provider === "drive" ? "https://www.googleapis.com/auth/drive.file" : "https://www.googleapis.com/auth/youtube.readonly");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function beginEventGoogleConnection(principal: TrustedCreatorPrincipal, ownerId: string, provider: EventGoogleProvider, returnPath: string, client: DatabaseClient = db) {
	if (!["drive", "youtube"].includes(provider) || !safeReturnPath(returnPath)) return eventError(new EventError("INVALID_INPUT"));
	if (principal.kind !== "session" || !principal.sessionId) return eventError(new EventError("AUTHENTICATION_REQUIRED"));
	if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) return eventError(new EventError("PROVIDER_UNAVAILABLE"));
	const intent = randomBytes(32).toString("base64url");
	try {
		await client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			const [session] = await tx
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, principal.sessionId!), eq(sessions.userId, principal.authUserId), gt(sessions.expiresAt, new Date())))
				.limit(1);
			if (!session) throw new EventError("AUTHENTICATION_REQUIRED");
			await tx.delete(intents).where(lt(intents.expiresAt, new Date()));
			await tx.insert(intents).values({ digest: digest(intent), ownerId, authUserId: principal.authUserId, sessionId: principal.sessionId!, provider, returnPath, expiresAt: new Date(Date.now() + 600000) });
			authority.assertAuthorityCurrent();
		});
		const callback = new URL(`/dashboard/events/connect/${provider}/complete`, resolveBaseUrl().origin);
		callback.searchParams.set("intent", intent);
		return { ok: true as const, link: { provider: eventGoogleProviderIds[provider], callbackURL: callback.toString(), errorCallbackURL: callback.toString(), scopes: [eventGoogleScope(provider)], additionalData: { eventConnectionIntent: intent }, additionalParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "false" } } };
	} catch (error) {
		await client.delete(intents).where(eq(intents.digest, digest(intent)));
		return eventError(error);
	}
}
export async function recordEventGoogleAccount(account: { id: string; userId: string; providerId: string; scope?: string | null }, intent: string, client: DatabaseClient = db) {
	if (!Object.values(eventGoogleProviderIds).some((provider) => provider === account.providerId) || !/^[A-Za-z0-9_-]{43}$/.test(intent)) return null;
	const [claim] = await client
		.select({ intent: intents, session: sessions })
		.from(intents)
		.innerJoin(sessions, and(eq(sessions.id, intents.sessionId), eq(sessions.userId, intents.authUserId)))
		.where(and(eq(intents.digest, digest(intent)), eq(intents.authUserId, account.userId), gt(intents.expiresAt, new Date()), gt(sessions.expiresAt, new Date())))
		.limit(1);
	if (!claim) return null;
	if (account.providerId !== eventGoogleProviderIds[claim.intent.provider]) throw new EventError("PROVIDER_UNAVAILABLE");
	const [linked] = await client
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, account.id), eq(accounts.userId, account.userId), eq(accounts.providerId, eventGoogleProviderIds[claim.intent.provider])))
		.limit(1);
	if (!linked || !(linked.scope ?? "").split(/[ ,]+/).includes(eventGoogleScope(claim.intent.provider))) throw new EventError("PROVIDER_UNAVAILABLE");
	const { auth } = await import("@/auth/config");
	const token = await withSerializedProviderCredential(dbPool, account.id, () => auth.api.getAccessToken({ body: { accountId: account.id, userId: account.userId } }));
	let identity: { id: string; name: string };
	if (claim.intent.provider === "youtube") identity = await fetchStreamingChannel("youtube", token.accessToken, process.env.YOUTUBE_CLIENT_ID!);
	else {
		const body = (await requestProviderJson("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Clipify Events", mimeType: "application/vnd.google-apps.folder" }) })) as { id?: unknown };
		if (typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(body.id)) throw new EventError("PROVIDER_UNAVAILABLE");
		identity = { id: body.id, name: "Google Drive" };
	}
	const principal: TrustedCreatorPrincipal = { kind: "session", authUserId: account.userId, sessionId: claim.session.id, authenticatedAt: claim.session.createdAt, organizationId: claim.session.activeOrganizationId };
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, claim.intent.ownerId, "event:update", tx);
		const [current] = await tx
			.select()
			.from(intents)
			.where(and(eq(intents.digest, digest(intent)), eq(intents.authUserId, account.userId), gt(intents.expiresAt, new Date())))
			.limit(1)
			.for("update");
		if (!current) return null;
		const values = { ownerId: current.ownerId, provider: current.provider, authAccountId: account.id, authUserId: account.userId, identityId: identity.id, identityName: identity.name, connected: true, updatedAt: new Date() };
		const [row] = await tx
			.insert(connections)
			.values(values)
			.onConflictDoUpdate({ target: [connections.ownerId, connections.provider], set: values })
			.returning();
		await tx.update(intents).set({ connectionId: row.id }).where(eq(intents.digest, current.digest));
		authority.assertAuthorityCurrent();
		return row;
	});
}
export async function completeEventGoogleConnection(principal: TrustedCreatorPrincipal, provider: EventGoogleProvider, intent: string, client: DatabaseClient = db) {
	if (principal.kind !== "session" || !principal.sessionId || !/^[A-Za-z0-9_-]{43}$/.test(intent)) return null;
	return client.transaction(async (tx) => {
		const [claim] = await tx
			.select()
			.from(intents)
			.where(and(eq(intents.digest, digest(intent)), eq(intents.provider, provider), eq(intents.authUserId, principal.authUserId), eq(intents.sessionId, principal.sessionId!), gt(intents.expiresAt, new Date())))
			.limit(1);
		if (!claim) return null;
		const authority = await authorizeLockedMutation(principal, claim.ownerId, "event:update", tx);
		await tx.delete(intents).where(eq(intents.digest, claim.digest));
		authority.assertAuthorityCurrent();
		return { ownerId: claim.ownerId, returnPath: claim.returnPath, connected: !!claim.connectionId };
	});
}
export async function listEventConnections(principal: TrustedCreatorPrincipal, ownerId: string, client: DatabaseClient = db) {
	try {
		return await client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:read", tx);
			const rows = await tx
				.select({ id: connections.id, provider: connections.provider, identityName: connections.identityName, connected: connections.connected, authProvider: accounts.providerId })
				.from(connections)
				.leftJoin(accounts, and(eq(accounts.id, connections.authAccountId), eq(accounts.userId, connections.authUserId)))
				.where(eq(connections.ownerId, ownerId));
			authority.assertAuthorityCurrent();
			return { ok: true as const, connections: rows.map(({ authProvider, ...connection }) => ({ ...connection, connected: connection.connected && (connection.provider === "s3" || authProvider === eventGoogleProviderIds[connection.provider]) })) };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function eventGoogleToken(ownerId: string, provider: EventGoogleProvider, client: DatabaseClient = db) {
	const [connection] = await client
		.select()
		.from(connections)
		.where(and(eq(connections.ownerId, ownerId), eq(connections.provider, provider), eq(connections.connected, true)))
		.limit(1);
	if (!connection?.authAccountId || !connection.authUserId) throw new EventError("PROVIDER_UNAVAILABLE");
	const [account] = await client
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, connection.authAccountId), eq(accounts.userId, connection.authUserId), eq(accounts.providerId, eventGoogleProviderIds[provider])))
		.limit(1);
	if (!account || !(account.scope ?? "").split(/[ ,]+/).includes(eventGoogleScope(provider))) throw new EventError("PROVIDER_UNAVAILABLE");
	const { auth } = await import("@/auth/config");
	const token = await withSerializedProviderCredential(dbPool, account.id, () => auth.api.getAccessToken({ body: { accountId: account.id, userId: connection.authUserId! } }));
	return { connection, accessToken: token.accessToken };
}

export async function disconnectEventConnectionsForAuthAccount(accountId: string, authUserId: string, client: DatabaseClient = db) {
	await client
		.update(connections)
		.set({ connected: false, authAccountId: null, updatedAt: new Date() })
		.where(and(eq(connections.authAccountId, accountId), eq(connections.authUserId, authUserId)));
}

export async function saveEventS3Connection(principal: TrustedCreatorPrincipal, ownerId: string, raw: unknown, client: DatabaseClient = db) {
	const parsed = s3CredentialsSchema.safeParse(raw);
	if (!parsed.success) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			const [existing] = await tx
				.select()
				.from(connections)
				.where(and(eq(connections.ownerId, ownerId), eq(connections.provider, "s3")))
				.limit(1)
				.for("update");
			if (existing) {
				const [asset] = await tx.select({ id: awardAssetsTable.id }).from(awardAssetsTable).where(eq(awardAssetsTable.connectionId, existing.id)).limit(1);
				if (asset) {
					const previous = eventS3Credentials(existing);
					if (new URL(previous.endpoint).origin !== new URL(parsed.data.endpoint).origin || previous.bucket !== parsed.data.bucket || previous.region !== parsed.data.region) throw new EventError("CONFLICT");
				}
			}
			const key = `${parsed.data.prefix ? `${parsed.data.prefix}/` : ""}connection-check-${randomBytes(16).toString("hex")}`;
			try {
				const probe = await s3Request(parsed.data, "PUT", key, { headers: new Headers({ "Content-Length": "0", "Content-Type": "application/octet-stream" }), signal: AbortSignal.timeout(10000) });
				await probe.body?.cancel();
				if (!probe.ok) throw new EventError("PROVIDER_UNAVAILABLE");
			} finally {
				const cleanup = await s3Request(parsed.data, "DELETE", key);
				await cleanup.body?.cancel();
				if (!cleanup.ok) throw new EventError("PROVIDER_UNAVAILABLE");
			}
			const values = { ownerId, provider: "s3" as const, authAccountId: null, authUserId: principal.authUserId, identityId: parsed.data.bucket, identityName: parsed.data.bucket, encryptedConfiguration: encryptString(JSON.stringify(parsed.data)), connected: true, updatedAt: new Date() };
			const [row] = await tx
				.insert(connections)
				.values(values)
				.onConflictDoUpdate({ target: [connections.ownerId, connections.provider], set: values })
				.returning({ id: connections.id, provider: connections.provider, identityName: connections.identityName, connected: connections.connected });
			authority.assertAuthorityCurrent();
			return { ok: true as const, connection: row };
		});
	} catch (error) {
		return eventError(error);
	}
}
export function eventS3Credentials(connection: typeof connections.$inferSelect) {
	if (connection.provider !== "s3" || !connection.connected || !connection.encryptedConfiguration) throw new EventError("STORAGE_REQUIRED");
	const decrypted = decryptString(connection.encryptedConfiguration);
	if (!decrypted) throw new EventError("STORAGE_REQUIRED");
	try {
		return s3CredentialsSchema.parse(JSON.parse(decrypted));
	} catch {
		throw new EventError("STORAGE_REQUIRED");
	}
}
