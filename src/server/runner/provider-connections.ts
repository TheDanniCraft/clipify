import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient, type TransactionClient } from "@/db/client";
import { runnerProviderConnectionsTable as connections, runnerProviderStatesTable as states } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { encryptString, decryptString } from "@/app/lib/encryption";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { providerAuthorizationUrl, streamingProviderSchema, type StreamingProvider } from "./provider-contract";
import { exchangeStreamingCode, fetchStreamingChannel, refreshStreamingTokens, ProviderRequestError, type StreamingTokens, type ProviderContext } from "./provider-api";
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
	return { clientId, clientSecret, redirectUri: new URL(`/runner/connect/${provider}/callback`, resolveBaseUrl().origin).toString() };
}
export async function beginStreamingConnection(principal: TrustedCreatorPrincipal, raw: unknown, client: DatabaseClient = db, clock = Date.now) {
	const parsed = inputSchema.safeParse(raw);
	if (!parsed.success) return fail("Choose a streaming provider.");
	if (principal.kind !== "session" || !principal.sessionId) return fail("Sign in again to connect a channel.");
	const config = streamingProviderConfiguration(parsed.data.provider);
	if (!config) return fail("Account connection is not available yet. You can enter a stream key instead.");
	const state = randomBytes(32).toString("base64url");
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, parsed.data.ownerId, "runner:update", tx);
		await tx.delete(states).where(lt(states.expiresAt, new Date(clock())));
		await tx.insert(states).values({ digest: digest(state), ownerId: parsed.data.ownerId, authUserId: principal.authUserId, sessionId: principal.sessionId!, provider: parsed.data.provider, expiresAt: new Date(clock() + 600000) });
		authority.assertAuthorityCurrent();
		return { success: true as const, url: providerAuthorizationUrl(parsed.data.provider, { ...config, state }) };
	});
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
		return { ownerId: row.ownerId };
	});
}
export async function completeStreamingConnection(principal: TrustedCreatorPrincipal, provider: StreamingProvider, state: string, code: string, client: DatabaseClient = db) {
	const claim = await consumeStreamingState(principal, provider, state, client);
	if (!claim) return fail("This connection request expired. Please try again.");
	const config = streamingProviderConfiguration(provider);
	if (!config || !code || code.length > 4096) return fail("Could not connect this channel. Please try again.");
	const tokens = await exchangeStreamingCode(provider, { ...config, code });
	const channel = await fetchStreamingChannel(provider, tokens.accessToken, config.clientId);
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, claim.ownerId, "runner:update", tx);
		const [previous] = await tx
			.select()
			.from(connections)
			.where(and(eq(connections.ownerId, claim.ownerId), eq(connections.provider, provider), eq(connections.channelId, channel.id)))
			.limit(1)
			.for("update");
		// Preserve an existing offline grant if the provider does not reissue its refresh token.
		if (!tokens.refreshToken && previous) {
			const old = readTokens(previous.encryptedTokens);
			tokens.refreshToken = old.refreshToken;
		}
		if (!tokens.refreshToken) throw new ProviderRequestError("RECONNECT_REQUIRED");
		const values = { ownerId: claim.ownerId, provider, channelId: channel.id, channelName: channel.name, encryptedTokens: encryptString(JSON.stringify(tokens)), updatedAt: new Date() };
		const [row] = await tx
			.insert(connections)
			.values(values)
			.onConflictDoUpdate({ target: [connections.ownerId, connections.provider, connections.channelId], set: values })
			.returning();
		authority.assertAuthorityCurrent();
		return { success: true as const, connection: { id: row.id, provider, channelName: row.channelName } };
	});
}
const storedTokens = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1).optional(), expiresAt: z.number().finite() });
function readTokens(encrypted: string): StreamingTokens {
	const decrypted = decryptString(encrypted);
	try {
		return storedTokens.parse(JSON.parse(decrypted ?? ""));
	} catch {
		throw new ProviderRequestError("RECONNECT_REQUIRED");
	}
}
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
		let tokens = readTokens(row.encryptedTokens);
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
