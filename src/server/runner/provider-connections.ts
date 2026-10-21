import "server-only";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { withSerializedProviderCredential } from "@/server/provider-credentials";
import { db, dbPool, type DatabaseClient, type TransactionClient } from "@/db/client";
import { runnerProviderConnectionsTable as connections, runnerProviderStatesTable as states } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { encryptString, decryptString } from "@/app/lib/encryption";
import { account as authAccount, session as authSession, verification as authVerification } from "@/db/auth-schema";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { providerLinkRequest, providerScopes, streamingProviderSchema, type StreamingProvider } from "./provider-contract";
import { fetchStreamingChannel, refreshStreamingTokens, ProviderRequestError, type StreamingTokens, type ProviderContext } from "./provider-api";
const inputSchema = z
	.object({
		ownerId: z
			.string()
			.min(1)
			.max(255)
			.regex(/^[A-Za-z0-9_-]+$/),
		provider: streamingProviderSchema,
	})
	.strict();
const fail = (error: string) => ({ success: false as const, error, code: "INVALID_INPUT" as const });
function digest(value: string) {
	return createHash("sha256").update(value).digest("hex");
}
export function streamingProviderConfiguration(provider: StreamingProvider) {
	const clientId = process.env[provider === "twitch" ? "TWITCH_CLIENT_ID" : "YOUTUBE_CLIENT_ID"]?.trim();
	const clientSecret = process.env[provider === "twitch" ? "TWITCH_CLIENT_SECRET" : "YOUTUBE_CLIENT_SECRET"]?.trim();
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}
export async function beginStreamingConnection(principal: TrustedCreatorPrincipal, raw: unknown, client: DatabaseClient = db, clock = Date.now, requestHeaders?: Headers) {
	const parsed = inputSchema.safeParse(raw);
	if (!parsed.success) return fail("Choose a streaming provider.");
	if (principal.kind !== "session" || !principal.sessionId) return fail("Sign in again to connect a channel.");
	const config = streamingProviderConfiguration(parsed.data.provider);
	if (!config) return fail("Account connection is not available yet. You can enter a stream key instead.");
	const state = randomBytes(32).toString("base64url");
	await client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, parsed.data.ownerId, "runner:update", tx);
		await tx.delete(states).where(lt(states.expiresAt, new Date(clock())));
		await tx.insert(states).values({ digest: digest(state), ownerId: parsed.data.ownerId, authUserId: principal.authUserId, sessionId: principal.sessionId!, provider: parsed.data.provider, expiresAt: new Date(clock() + 600000) });
		authority.assertAuthorityCurrent();
	});
	const { auth } = await import("@/auth/config");
	const headers = requestHeaders ?? (await (await import("next/headers")).headers());
	try {
		const result = await auth.api.linkSocialAccount({ headers, body: providerLinkRequest(parsed.data.provider, resolveBaseUrl().origin, state) });
		return { success: true as const, url: result.url };
	} catch {
		await client.delete(states).where(eq(states.digest, digest(state)));
		return fail("Could not start channel authorization. Please try again.");
	}
}
export async function consumeStreamingState(principal: TrustedCreatorPrincipal, provider: StreamingProvider, state: string, client: DatabaseClient = db, clock = Date.now) {
	if (principal.kind !== "session" || !principal.sessionId || !/^[A-Za-z0-9_-]{43}$/.test(state)) return null;
	return client.transaction(async (tx) => {
		const [row] = await tx
			.delete(states)
			.where(and(eq(states.digest, digest(state)), eq(states.provider, provider), eq(states.authUserId, principal.authUserId), eq(states.sessionId, principal.sessionId!), gt(states.expiresAt, new Date(clock()))))
			.returning();
		if (!row) return null;
		const authority = await authorizeLockedMutation(principal, row.ownerId, "runner:update", tx);
		authority.assertAuthorityCurrent();
		const [result] = await tx
			.delete(authVerification)
			.where(and(eq(authVerification.identifier, `runner-connection:${digest(state)}`), gt(authVerification.expiresAt, new Date(clock()))))
			.returning({ connectionId: authVerification.value });
		return { ownerId: row.ownerId, connectionId: result?.connectionId };
	});
}
/** Called only after Better Auth persists the exact account selected by its verified callback. */
export async function recordStreamingAccount(account: { id: string; userId: string; providerId: string; scope?: string | null }, intent: unknown, client: DatabaseClient = db) {
	if (typeof intent !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(intent)) return;
	const provider: StreamingProvider | null = account.providerId === "google" ? "youtube" : account.providerId === "twitch" ? "twitch" : null;
	if (!provider) return;
	const [claim] = await client
		.select({ intent: states, session: authSession })
		.from(states)
		.innerJoin(authSession, and(eq(authSession.id, states.sessionId), eq(authSession.userId, states.authUserId)))
		.where(and(eq(states.digest, digest(intent)), eq(states.provider, provider), eq(states.authUserId, account.userId), gt(states.expiresAt, new Date()), gt(authSession.expiresAt, new Date())))
		.limit(1);
	if (!claim) return;
	const principal: TrustedCreatorPrincipal = { kind: "session", authUserId: account.userId, sessionId: claim.session.id, authenticatedAt: claim.session.createdAt, organizationId: claim.session.activeOrganizationId };
	const config = streamingProviderConfiguration(provider);
	if (!config) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	const scopes = (account.scope ?? "").split(/[ ,]+/);
	if (providerScopes(provider).some((scope) => !scopes.includes(scope))) throw new ProviderRequestError("RECONNECT_REQUIRED");
	const { auth } = await import("@/auth/config");
	let token;
	try {
		token = await withSerializedProviderCredential(dbPool, account.id, () => auth.api.getAccessToken({ body: { accountId: account.id, userId: account.userId } }));
	} catch {
		throw new ProviderRequestError("RECONNECT_REQUIRED");
	}
	const channel = await fetchStreamingChannel(provider, token.accessToken, config.clientId);
	return client.transaction(async (tx) => {
		const [pending] = await tx
			.select({ id: states.digest })
			.from(states)
			.innerJoin(authSession, and(eq(authSession.id, states.sessionId), eq(authSession.userId, states.authUserId)))
			.where(and(eq(states.digest, digest(intent)), eq(states.authUserId, account.userId), gt(states.expiresAt, new Date()), gt(authSession.expiresAt, new Date())))
			.limit(1)
			.for("update", { of: states });
		if (!pending) return;
		const authority = await authorizeLockedMutation(principal, claim.intent.ownerId, "runner:update", tx);
		const [linked] = await tx
			.select()
			.from(authAccount)
			.where(and(eq(authAccount.id, account.id), eq(authAccount.userId, account.userId), eq(authAccount.providerId, account.providerId)))
			.limit(1);
		if (!linked?.refreshToken) throw new ProviderRequestError("RECONNECT_REQUIRED");
		// Keep one token owner so login and broadcasting cannot rotate separate copies.
		const values = { ownerId: claim.intent.ownerId, provider, channelId: channel.id, channelName: channel.name, encryptedTokens: encryptString(JSON.stringify({ authAccountId: account.id, authUserId: account.userId })), updatedAt: new Date() };
		const [row] = await tx
			.insert(connections)
			.values(values)
			.onConflictDoUpdate({ target: [connections.ownerId, connections.provider, connections.channelId], set: values })
			.returning();
		const identifier = `runner-connection:${digest(intent)}`;
		await tx.delete(authVerification).where(eq(authVerification.identifier, identifier));
		await tx.insert(authVerification).values({ id: randomUUID(), identifier, value: row.id, expiresAt: claim.intent.expiresAt });
		authority.assertAuthorityCurrent();
	});
}
export async function completeStreamingConnection(principal: TrustedCreatorPrincipal, provider: StreamingProvider, intent: string, client: DatabaseClient = db) {
	const claim = await consumeStreamingState(principal, provider, intent, client);
	if (!claim?.connectionId) return fail("This connection request expired or was not completed. Please try again.");
	const [row] = await client
		.select({ id: connections.id, provider: connections.provider, channelName: connections.channelName })
		.from(connections)
		.where(and(eq(connections.id, claim.connectionId), eq(connections.ownerId, claim.ownerId)))
		.limit(1);
	return row ? { success: true as const, connection: row } : fail("This channel is unavailable. Please reconnect it.");
}
const linkedAccount = z.object({ authAccountId: z.string().min(1), authUserId: z.string().min(1) });
const storedTokens = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1).optional(), expiresAt: z.number().finite() });
/** Row lock serializes refresh-token rotation across all Runners using this channel. */
export async function withStreamingConnection<T>(tx: TransactionClient, ownerId: string, id: string, run: (context: ProviderContext) => Promise<T>) {
	try {
		const [row] = await tx
			.select()
			.from(connections)
			.where(and(eq(connections.ownerId, ownerId), eq(connections.id, id)))
			.limit(1)
			.for("update");
		if (!row || row.provider === "custom") throw new ProviderRequestError("RECONNECT_REQUIRED");
		const config = streamingProviderConfiguration(row.provider);
		if (!config) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
		let saved: unknown;
		try {
			saved = JSON.parse(decryptString(row.encryptedTokens) ?? "null");
		} catch {
			throw new ProviderRequestError("RECONNECT_REQUIRED");
		}
		const reference = linkedAccount.safeParse(saved);
		if (reference.success) {
			const [account] = await tx
				.select()
				.from(authAccount)
				.where(and(eq(authAccount.id, reference.data.authAccountId), eq(authAccount.userId, reference.data.authUserId), eq(authAccount.providerId, row.provider === "youtube" ? "google" : "twitch")))
				.limit(1);
			if (!account || providerScopes(row.provider).some((scope) => !(account.scope ?? "").split(/[ ,]+/).includes(scope))) throw new ProviderRequestError("RECONNECT_REQUIRED");
			const { auth } = await import("@/auth/config");
			let token;
			try {
				token = await withSerializedProviderCredential(dbPool, account.id, () => auth.api.getAccessToken({ body: { accountId: account.id, userId: account.userId } }));
			} catch {
				throw new ProviderRequestError("RECONNECT_REQUIRED");
			}
			const value = await run({ provider: row.provider, accessToken: token.accessToken, clientId: config.clientId, channelId: row.channelId });
			return { success: true as const, value };
		}
		const parsedTokens = storedTokens.safeParse(saved);
		if (!parsedTokens.success) throw new ProviderRequestError("RECONNECT_REQUIRED");
		let tokens: StreamingTokens = parsedTokens.data;
		if (tokens.expiresAt < Date.now() + 60000) {
			if (!tokens.refreshToken) throw new ProviderRequestError("RECONNECT_REQUIRED");
			tokens = await refreshStreamingTokens(row.provider, { ...config, refreshToken: tokens.refreshToken });
			await tx
				.update(connections)
				.set({ encryptedTokens: encryptString(JSON.stringify(tokens)), updatedAt: new Date() })
				.where(eq(connections.id, row.id));
		}
		const value = await run({ provider: row.provider, accessToken: tokens.accessToken, clientId: config.clientId, channelId: row.channelId });
		return { success: true as const, value };
	} catch (error) {
		if (!(error instanceof ProviderRequestError)) throw error;
		// Expected downstream denials must commit any successful refresh-token rotation.
		return { success: false as const, error: error.message, code: error.code };
	}
}
export async function listStreamingConnections(principal: TrustedCreatorPrincipal, ownerId: string, client: DatabaseClient = db) {
	if (!inputSchema.shape.ownerId.safeParse(ownerId).success) return fail("Choose an account.");
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, ownerId, "runner:read", tx);
		const rows = await tx.select({ id: connections.id, provider: connections.provider, channelName: connections.channelName }).from(connections).where(eq(connections.ownerId, ownerId));
		authority.assertAuthorityCurrent();
		return { success: true as const, connections: rows };
	});
}
