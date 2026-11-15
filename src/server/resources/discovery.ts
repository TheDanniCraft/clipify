import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { workflowOperation } from "./workflow";
import { fetchClipDiscovery, publicClip } from "./clip-discovery";
import { searchCachedClips } from "./cached-clip-search";
export function searchClips(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "search_clips", input, (parsed) => searchCachedClips(parsed, `${principal.grantId}:${principal.generation}`), client);
}

import { parseClipReference } from "./clip-references";
import { resolveValidatedPlaylistClips } from "./clip-validation";
export function resolveClip(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"resolve_clip",
		input,
		async (input) => {
			const [clip] = await resolveValidatedPlaylistClips(input.creatorId, [parseClipReference(input.reference)]);
			if (clip.broadcaster_id !== input.creatorId) throw new Error("RESOURCE_UNAVAILABLE");
			return { creatorId: input.creatorId, clip: publicClip(clip) };
		},
		client,
	);
}

import { and, eq } from "drizzle-orm";
import { playlistsTable, playlistClipsTable } from "@/db/schema";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
import { nextConfigurationRevision } from "./revisions";
import { FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";
import { encodeImportSelection } from "./import-selection";
import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
export function previewPlaylistImport(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"preview_playlist_import",
		input,
		async (input, { tx, pro }) => {
			const [playlist] = await tx
				.select()
				.from(playlistsTable)
				.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
				.limit(1);
			if (!playlist) throw new Error("RESOURCE_UNAVAILABLE");
			nextConfigurationRevision(playlist.configurationRevision, input.expectedRevision);
			const access = await resolveRetainedResourceAccess({ kind: "playlist", ownerId: input.creatorId, resourceId: playlist.id, client: tx });
			if (!access.update) throw new Error("FEATURE_RESTRICTED");
			if (input.filters && (!pro || !(await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "creator:read", client: tx })).allowed)) throw new Error(pro ? "ACCESS_DENIED" : "FEATURE_RESTRICTED");
			let matched;
			if (input.clips) {
				const ids = [...new Set(input.clips.map(parseClipReference))];
				matched = await resolveValidatedPlaylistClips(input.creatorId, ids);
				if (matched.some((clip) => clip.broadcaster_id !== input.creatorId)) throw new Error("RESOURCE_UNAVAILABLE");
			} else {
				const result = await fetchClipDiscovery(input.creatorId, { ...input.filters, endedAt: input.filters!.endedAt ?? new Date().toISOString() });
				if (!result.complete) return { playlistId: playlist.id, expectedRevision: playlist.configurationRevision, complete: false, canCommit: false, requiresConfirmation: true, proposed: result.clips.map(publicClip), duplicates: [], previewToken: null, reason: "The clip cache or category metadata is incomplete. Check get_clip_crawler_status or use a category ID, then retry when the required data is available." };
				matched = result.clips;
			}
			const existing = await tx.select({ id: playlistClipsTable.clipId }).from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlist.id));
			const existingIds = new Set(existing.map((row) => row.id));
			const proposed = matched.filter((clip) => !existingIds.has(clip.id)).map(publicClip);
			const duplicates = matched.filter((clip) => existingIds.has(clip.id)).map(publicClip);
			const remaining = pro ? null : Math.max(0, FREE_PLAYLIST_CLIP_LIMIT - existing.length);
			const canCommit = remaining === null || proposed.length <= remaining;
			const selection = { creatorId: input.creatorId, playlistId: playlist.id, expectedRevision: playlist.configurationRevision, clipIds: proposed.map((clip) => clip.id), requiresPro: Boolean(input.filters) };
			return { playlistId: playlist.id, expectedRevision: playlist.configurationRevision, complete: true, canCommit, requiresConfirmation: true, proposed, duplicates, usage: existing.length, remainingQuota: remaining, previewToken: canCommit ? encodeImportSelection(selection, principal) : null, expiresInSeconds: 600 };
		},
		client,
	);
}

import { decodeImportSelection } from "./import-selection";
import { workflowRetry } from "./workflow";
import { savePlaylistItemSelection } from "./playlist-items";
export function commitPlaylistImport(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"commit_playlist_import",
		input,
		async (input, context) => {
			const selection = decodeImportSelection(input.previewToken, principal, input);
			if (selection.requiresPro && !context.pro) throw new Error("FEATURE_RESTRICTED");
			const [playlist] = await context.tx
				.select()
				.from(playlistsTable)
				.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
				.limit(1);
			if (!playlist) throw new Error("RESOURCE_UNAVAILABLE");
			return workflowRetry(context, "commit_playlist_import", input, async () => {
				nextConfigurationRevision(playlist.configurationRevision, selection.expectedRevision);
				if (!selection.clipIds.length) return { id: playlist.id, creatorId: input.creatorId, configurationRevision: playlist.configurationRevision, addedClipIds: [], addedCount: 0 };
				return savePlaylistItemSelection(principal, { creatorId: input.creatorId, playlistId: playlist.id, clipIds: selection.clipIds, mode: "append", expectedRevision: selection.expectedRevision, requirePro: selection.requiresPro }, context.tx, {
					tool: "commit_playlist_import",
					skipAudit: true,
					projectResult: async (saved) => ({ id: saved.id, creatorId: input.creatorId, configurationRevision: saved.configurationRevision, addedClipIds: selection.clipIds, addedCount: selection.clipIds.length }),
				});
			});
		},
		client,
	);
}
