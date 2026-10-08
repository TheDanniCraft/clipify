import "server-only";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { playlistsTable, playlistClipsTable } from "@/db/schema";
import { authorizeTrustedCreatorOperation, type CreatorOperationResult, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { Permission } from "@/auth/permissions";

/** Native dashboard discovery and targeted OAuth pagination share authorized persistence. */
export async function listPlaylistRecords(options: { principal: TrustedCreatorPrincipal; creatorId?: string; creatorIds?: readonly string[]; afterId?: string | (() => string); limit?: number }, client: QueryClient = db) {
	if (!options?.principal) throw new Error("AUTHENTICATION_REQUIRED");
	if (!options.creatorId && options.principal.kind === "oauth") throw new Error("INVALID_INPUT");
	const access: Array<Extract<CreatorOperationResult, { allowed: true }>> = [];
	const ownerIds = options.creatorId ? [options.creatorId] : [...new Set(options.creatorIds ?? [])];
	for (const creatorId of ownerIds) {
		const authority = { creatorId, resourceOwnerId: creatorId, permission: "playlist:read" as const };
		const decision = await authorizeTrustedCreatorOperation({ ...authority, principal: options.principal, client });
		if (!decision.allowed) throw new Error("ACCESS_DENIED");
		access.push(decision);
	}
	if (!ownerIds.length) return { records: [], access };
	const afterId = typeof options.afterId === "function" ? options.afterId() : options.afterId;
	const query = client
		.select()
		.from(playlistsTable)
		.where(and(inArray(playlistsTable.ownerId, ownerIds), afterId ? gt(playlistsTable.id, afterId) : undefined));
	const records = options.limit === undefined ? await query.execute() : await query.orderBy(asc(playlistsTable.id)).limit(options.limit).execute();
	return { records, access };
}

/** Internal owner-bound lookup; public adapters obtain current authorization first. */
export async function findPlaylistRecord(playlistId: string, creatorId?: string, client: QueryClient = db) {
	const [playlist] = await client
		.select()
		.from(playlistsTable)
		.where(and(eq(playlistsTable.id, playlistId), creatorId ? eq(playlistsTable.ownerId, creatorId) : undefined))
		.limit(1)
		.execute();
	return playlist;
}

export async function readPlaylistRecord(playlistId: string, options: { principal: TrustedCreatorPrincipal; creatorId?: string; permission?: Permission }, client: QueryClient = db) {
	if (!options?.principal) throw new Error("AUTHENTICATION_REQUIRED");
	let playlist: typeof playlistsTable.$inferSelect | undefined;
	if (!options.creatorId) playlist = await findPlaylistRecord(playlistId, undefined, client);
	const creatorId = options.creatorId ?? playlist?.ownerId;
	if (!creatorId) throw new Error("RESOURCE_UNAVAILABLE");
	const authority = { creatorId, resourceOwnerId: creatorId, permission: options.permission ?? "playlist:read" };
	const decision = await authorizeTrustedCreatorOperation({ ...authority, principal: options.principal, client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	if (!playlist) playlist = await findPlaylistRecord(playlistId, creatorId, client);
	if (!playlist) throw new Error("RESOURCE_UNAVAILABLE");
	return playlist;
}

/** Metadata projection stays with each adapter; both read the same stored order. */
export async function readPlaylistItemRecords(playlistId: string, client: QueryClient = db) {
	return client.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlistId)).orderBy(asc(playlistClipsTable.position), asc(playlistClipsTable.clipId)).execute();
}
