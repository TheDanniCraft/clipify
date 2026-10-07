import "server-only";
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { QueryClient } from "@/db/client";
export async function getCreatorSummary(principal: TrustedCreatorPrincipal, creatorId: string, client?: QueryClient) {
	const decision = await authorizeTrustedCreatorOperation({ principal, creatorId, permission: "creator:read", client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	return { id: decision.creator.id, name: decision.creator.username };
}

import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { overlaysTable, playlistsTable, playlistClipsTable, galleriesTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { FREE_PLAYLIST_LIMIT, FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";
import { FREE_GALLERY_LIMIT } from "@lib/gallery";
import { toolPermissions } from "./permissions";
import { encodePageCursor, decodePageCursor } from "./pagination";

export async function listCreators(principal: TrustedCreatorPrincipal, input: { limit: number; cursor?: string }, client: QueryClient = db) {
	const context = `${principal.grantId}:${principal.generation}:list_creators`;
	const position = input.cursor ? decodePageCursor(input.cursor, context) : undefined;
	const items = [];
	const targets = [...(principal.creators ?? [])].sort((a, b) => (a.creatorId < b.creatorId ? -1 : a.creatorId > b.creatorId ? 1 : 0));
	for (const target of targets) {
		if (position && target.creatorId <= position) continue;
		try {
			items.push(await getCreatorSummary(principal, target.creatorId, client));
		} catch (error) {
			if (!(error instanceof Error && error.message === "ACCESS_DENIED")) throw error;
		}
		if (items.length > input.limit) break;
	}
	const hasMore = items.length > input.limit;
	const page = items.slice(0, input.limit);
	return { items: page, nextCursor: hasMore ? encodePageCursor(page[page.length - 1].id, context) : null };
}

export async function getCapabilities(principal: TrustedCreatorPrincipal, creatorId: string, client: QueryClient = db) {
	const decision = await authorizeTrustedCreatorOperation({ principal, creatorId, permission: "creator:read", client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	const [entitlements, galleries, overlays, playlists, clips] = await Promise.all([
		resolveUserEntitlements(decision.creator, client),
		client.select({ count: count() }).from(galleriesTable).where(eq(galleriesTable.ownerId, creatorId)),
		client.select({ count: count() }).from(overlaysTable).where(eq(overlaysTable.ownerId, creatorId)),
		client.select({ count: count() }).from(playlistsTable).where(eq(playlistsTable.ownerId, creatorId)),
		client.select({ count: count() }).from(playlistClipsTable).innerJoin(playlistsTable, eq(playlistClipsTable.playlistId, playlistsTable.id)).where(eq(playlistsTable.ownerId, creatorId)),
	]);
	const usage = { overlays: overlays[0].count, playlists: playlists[0].count, playlistItems: clips[0].count, galleries: galleries[0].count };
	const pro = entitlements.effectivePlan === "pro";
	const limits = { overlays: pro ? null : 1, playlists: pro ? null : FREE_PLAYLIST_LIMIT, playlistItems: pro ? null : FREE_PLAYLIST_CLIP_LIMIT, galleries: pro ? null : FREE_GALLERY_LIMIT };
	const operations: Record<string, { allowed: boolean; reason?: string }> = {};
	for (const [name, permission] of Object.entries(toolPermissions)) {
		const allowed = await authorizeTrustedCreatorOperation({ principal, creatorId, permission, client });
		if (!allowed.allowed) operations[name] = { allowed: false, reason: "ACCESS_DENIED" };
		else if ((name === "create_overlay" && limits.overlays !== null && usage.overlays >= limits.overlays) || (name === "create_playlist" && limits.playlists !== null && usage.playlists >= limits.playlists) || (name === "create_gallery" && limits.galleries !== null && usage.galleries >= limits.galleries)) operations[name] = { allowed: false, reason: "PLAN_LIMIT_REACHED" };
		else if ((!pro && ["get_overlay_runtime", "get_overlay_queues", "control_overlay", "enqueue_overlay_clip", "clear_overlay_queue"].includes(name)) || (!entitlements.runnerAccess && ["get_runner_setup", "create_runner", "configure_stream_session", "control_stream_session"].includes(name))) operations[name] = { allowed: false, reason: "FEATURE_RESTRICTED" };
		else operations[name] = { allowed: true };
	}
	return { creatorId, effectivePlan: entitlements.effectivePlan, usage, limits, operations, features: { advancedFilters: pro, remoteControl: pro, runnerAccess: entitlements.runnerAccess, advancedGalleries: pro, creatorPageSocialPreview: pro } };
}
