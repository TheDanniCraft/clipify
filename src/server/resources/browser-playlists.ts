import "server-only";
import { randomUUID } from "node:crypto";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { db } from "@/db/client";
import { playlistsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createPlaylistForPrincipal, updatePlaylistRecord, deletePlaylist, reorderPlaylistItems } from "./playlists";

/** Preserve the browser contract while using the shared locked quota service. */
export async function createBrowserPlaylist(creatorId: string, name: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return null;
	const normalizedName = name.trim().slice(0, 120);
	if (!normalizedName) throw new Error("Playlist name is required");
	try {
		const playlist = await createPlaylistForPrincipal(principal, { creatorId, name: normalizedName, retryKey: randomUUID() });
		if (!("ownerId" in playlist)) throw new Error("SERVICE_UNAVAILABLE");
		return playlist;
	} catch (error) {
		if (error instanceof Error && error.message === "ACCESS_DENIED") return null;
		if (error instanceof Error && error.message === "PLAN_LIMIT_REACHED") throw new Error("Free plan allows only one playlist");
		throw new Error("Failed to create playlist");
	}
}

/** A browser save must carry the revision the editor actually read. */
export async function saveBrowserPlaylist(playlistId: string, patch: { name?: string }, expectedRevision?: number, requestHeaders?: Headers) {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return null;
	const principal = await getVerifiedSessionPrincipal(requestHeaders);
	if (!principal) return null;
	const [current] = await db
		.select()
		.from(playlistsTable)
		.where(eq(playlistsTable.id, playlistId))
		.limit(1)
		.catch(() => {
			throw new Error("Failed to save playlist");
		});
	if (!current) return null;
	const name = (patch.name ?? current.name).trim().slice(0, 120);
	if (!name) throw new Error("Playlist name is required");
	try {
		return await updatePlaylistRecord(principal, { creatorId: current.ownerId, playlistId, name, expectedRevision });
	} catch (error) {
		if (error instanceof Error && ["ACCESS_DENIED", "FEATURE_RESTRICTED", "REVISION_CONFLICT", "INVALID_INPUT", "RESOURCE_UNAVAILABLE"].includes(error.message)) return null;
		throw new Error("Failed to save playlist");
	}
}

/** Delete against the revision the browser read, through the shared locked transaction. */
export async function deleteBrowserPlaylist(playlistId: string, expectedRevision?: number, requestHeaders?: Headers): Promise<boolean> {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return false;
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return false;
		const [current] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId)).limit(1);
		if (!current) return false;
		const result = await deletePlaylist(principal, { creatorId: current.ownerId, playlistId, expectedRevision });
		return result.deletedId === playlistId;
	} catch {
		return false;
	}
}

/** Reordering uses the same current authority, parent lock and exact revision as MCP. */
export async function reorderBrowserPlaylist(playlistId: string, itemIds: string[], expectedRevision?: number, requestHeaders?: Headers) {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return null;
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return null;
		const [current] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId)).limit(1);
		if (!current) return null;
		return await reorderPlaylistItems(principal, { creatorId: current.ownerId, playlistId, itemIds, expectedRevision });
	} catch {
		return null;
	}
}

/** Select clips by ID; caller-supplied metadata never becomes stored clip data. */
export async function saveBrowserPlaylistItems(playlistId: string, clipIds: string[], mode: "append" | "replace", expectedRevision?: number, name?: string, requestHeaders?: Headers, requirePro = false) {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return null;
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return null;
		const [current] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId)).limit(1);
		if (!current) return null;
		const { savePlaylistItemSelection } = await import("./playlist-items");
		return await savePlaylistItemSelection(principal, { creatorId: current.ownerId, playlistId, clipIds, mode, expectedRevision, requirePro, ...(name !== undefined ? { name } : {}) });
	} catch {
		return null;
	}
}
