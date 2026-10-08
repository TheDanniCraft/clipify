import "server-only";
import { savePlaylistItemSelection } from "./playlist-items";
import { listPlaylistRecords, readPlaylistRecord, readPlaylistItemRecords } from "./playlist-reads";
import { randomUUID } from "node:crypto";
import { nextConfigurationRevision } from "./revisions";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
import { count } from "drizzle-orm";
import type { DatabaseClient, TransactionClient } from "@/db/client";
import { usersTable, auditEventsTable, overlaysTable, galleriesTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { authorizeLockedMutation } from "./mutation";
import { assertCreationQuota } from "./quota";
import { createWithRetry } from "./create-retry";
import { and, asc, eq, sql } from "drizzle-orm";
import { type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { db, type QueryClient } from "@/db/client";
import { playlistsTable, playlistClipsTable } from "@/db/schema";
import { decodePageCursor, encodePageCursor } from "@/server/mcp/pagination";
import { playlistDto, playlistItemDto, toolInputSchemas } from "@/server/mcp/schemas";

export async function listPlaylists(principal: TrustedCreatorPrincipal, rawInput: unknown, client: QueryClient = db) {
	const parsed = toolInputSchemas.list_playlists.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const context = `${principal.grantId}:${principal.generation}:${principal.authUserId}:list_playlists:${input.creatorId}`;
	const { records: rows } = await listPlaylistRecords({ creatorId: input.creatorId, principal, afterId: input.cursor ? () => decodePageCursor(input.cursor!, context) : undefined, limit: input.limit + 1 }, client);
	const items = rows.slice(0, input.limit).map(playlistDto);
	return { items, nextCursor: rows.length > input.limit ? encodePageCursor(items[items.length - 1].id, context) : null };
}

export async function getPlaylist(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.get_playlist.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(
		async (tx) => {
			const playlist = await readPlaylistRecord(input.playlistId, { creatorId: input.creatorId, principal }, tx);
			return readPlaylistResult(playlist, tx);
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
}

async function readPlaylistResult(playlist: typeof playlistsTable.$inferSelect, client: QueryClient) {
	const rows = await readPlaylistItemRecords(playlist.id, client);
	const items = rows.map((row) => {
		let metadata: Record<string, unknown> = {};
		try {
			const value = JSON.parse(row.clipData);
			if (value && typeof value === "object" && !Array.isArray(value)) metadata = value.clip && typeof value.clip === "object" ? value.clip : value;
		} catch {}
		return playlistItemDto({ id: row.clipId, position: row.position, ...(typeof metadata.title === "string" ? { title: metadata.title } : {}), ...(typeof metadata.duration === "number" ? { duration: metadata.duration } : {}) });
	});
	return { playlist: playlistDto(playlist), items };
}

async function insertPlaylist(client: TransactionClient, input: { creatorId: string; name: string }) {
	const [owner] = await client.select().from(usersTable).where(eq(usersTable.id, input.creatorId)).limit(1);
	if (!owner) throw new Error("ACCESS_DENIED");
	const entitlements = await resolveUserEntitlements(owner, client);
	const [usage] = await client.select({ count: count() }).from(playlistsTable).where(eq(playlistsTable.ownerId, input.creatorId));
	assertCreationQuota(entitlements.effectivePlan, "playlist", usage.count);
	const [playlist] = await client.insert(playlistsTable).values({ ownerId: input.creatorId, name: input.name }).returning();
	if (!playlist) throw new Error("SERVICE_UNAVAILABLE");
	return playlist;
}
export async function createPlaylistForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.create_playlist.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		if (principal.kind === "oauth") return createWithRetry(tx, principal, "create_playlist", input, () => insertPlaylist(tx, input));
		await authorizeLockedMutation(principal, input.creatorId, "playlist:create", tx);
		return insertPlaylist(tx, input);
	});
}

export async function updatePlaylistRecord(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.update_playlist.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "playlist:update", tx);
		const [current] = await tx
			.select()
			.from(playlistsTable)
			.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		const access = await resolveRetainedResourceAccess({ kind: "playlist", ownerId: input.creatorId, resourceId: current.id, client: tx });
		if (!access.update) throw new Error("FEATURE_RESTRICTED");
		authorization.assertAuthorityCurrent();
		const [updated] = await tx.update(playlistsTable).set({ name: input.name, configurationRevision: revision, updatedAt: new Date() }).where(eq(playlistsTable.id, current.id)).returning();
		await tx.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
			targetType: "playlist",
			targetId: current.id,
			action: principal.kind === "oauth" ? "sensitive-integration:mcp.update_playlist" : "playlist.update",
			outcome: "success",
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { creatorId: input.creatorId, tool: "update_playlist", ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}), revision },
		});
		authorization.assertAuthorityCurrent();
		return updated;
	});
}

export async function updatePlaylist(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	return { playlist: playlistDto(await updatePlaylistRecord(principal, rawInput, client)) };
}

export async function removePlaylistItems(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.remove_playlist_items.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return savePlaylistItemSelection(principal, { creatorId: input.creatorId, playlistId: input.playlistId, expectedRevision: input.expectedRevision, clipIds: input.itemIds, mode: "remove" }, client, { tool: "remove_playlist_items", projectResult: readPlaylistResult });
}

export async function reorderPlaylistItems(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.reorder_playlist_items.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "playlist-items:manage", tx);
		const [current] = await tx
			.select()
			.from(playlistsTable)
			.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		const access = await resolveRetainedResourceAccess({ kind: "playlist", ownerId: input.creatorId, resourceId: current.id, client: tx });
		if (!access.update) throw new Error("FEATURE_RESTRICTED");
		authorization.assertAuthorityCurrent();
		const rows = await tx.select({ clipId: playlistClipsTable.clipId }).from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, current.id));
		const existingIds = new Set(rows.map((row) => row.clipId));
		if (input.itemIds.length !== existingIds.size || input.itemIds.some((id) => !existingIds.has(id))) throw new Error("INVALID_INPUT");
		for (const [position, id] of input.itemIds.entries()) {
			await tx
				.update(playlistClipsTable)
				.set({ position })
				.where(and(eq(playlistClipsTable.playlistId, current.id), eq(playlistClipsTable.clipId, id)));
		}
		await tx.update(playlistsTable).set({ configurationRevision: revision, updatedAt: new Date() }).where(eq(playlistsTable.id, current.id));
		await tx.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
			targetType: "playlist",
			targetId: current.id,
			action: principal.kind === "oauth" ? "sensitive-integration:mcp.reorder_playlist_items" : "playlist.items.reorder",
			outcome: "success",
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { creatorId: input.creatorId, tool: "reorder_playlist_items", revision, ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}) },
		});
		const result = await readPlaylistResult({ ...current, configurationRevision: revision }, tx);
		authorization.assertAuthorityCurrent();
		return result;
	});
}

export async function addPlaylistItems(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.add_playlist_items.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return savePlaylistItemSelection(principal, { creatorId: input.creatorId, playlistId: input.playlistId, expectedRevision: input.expectedRevision, clipIds: input.clipIds, mode: "append" }, client, { tool: "add_playlist_items", projectResult: readPlaylistResult });
}

export async function deletePlaylist(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.delete_playlist.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "playlist:delete", tx);
		const [current] = await tx
			.select()
			.from(playlistsTable)
			.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		const references = await tx.select().from(overlaysTable).where(eq(overlaysTable.playlistId, current.id)).orderBy(asc(overlaysTable.id)).for("update");
		authorization.assertAuthorityCurrent();
		for (const overlay of references)
			await tx
				.update(overlaysTable)
				.set({ playlistId: null, configurationRevision: nextConfigurationRevision(overlay.configurationRevision, overlay.configurationRevision), updatedAt: new Date() })
				.where(eq(overlaysTable.id, overlay.id));
		await tx
			.update(galleriesTable)
			.set({ playlistId: null, published: false, configurationRevision: sql`${galleriesTable.configurationRevision} + 1`, updatedAt: new Date() })
			.where(eq(galleriesTable.playlistId, current.id));
		await tx.delete(playlistsTable).where(eq(playlistsTable.id, current.id));
		await tx.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
			targetType: "playlist",
			targetId: current.id,
			action: principal.kind === "oauth" ? "sensitive-integration:mcp.delete_playlist" : "playlist.delete",
			outcome: "success",
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { creatorId: input.creatorId, tool: "delete_playlist", ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}), revision: current.configurationRevision },
		});
		authorization.assertAuthorityCurrent();
		return { deletedId: current.id };
	});
}
