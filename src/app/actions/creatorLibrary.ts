"use server";

import { readCreatorInventory } from "@/server/creator-library";
import { getTwitchClipPlaybackUrl } from "@actions/twitch";

export async function getCreatorClipInventory(input: { creatorId: string; query?: unknown; cachedOnly?: boolean }) {
	if (!input || typeof input.creatorId !== "string" || !input.creatorId || input.creatorId.length > 200 || (input.cachedOnly !== undefined && typeof input.cachedOnly !== "boolean")) return { ok: false as const, code: "INVALID_INPUT" };
	return input.cachedOnly ? readCreatorInventory(input.creatorId, input.query, true) : readCreatorInventory(input.creatorId, input.query);
}

export async function getCreatorClipPreview(input: { creatorId: string; clipId: string; refresh?: boolean }) {
	if (!input || typeof input.creatorId !== "string" || typeof input.clipId !== "string" || input.creatorId.length > 200 || (input.refresh !== undefined && typeof input.refresh !== "boolean") || input.clipId.length > 200) return null;
	const playbackUrl = await getTwitchClipPlaybackUrl(input.clipId, input.creatorId, { kind: "inventory", creatorId: input.creatorId, ...(input.refresh ? { refresh: true } : {}) });
	return playbackUrl ? { playbackUrl } : null;
}

export async function getCreatorClipOverview(input: { creatorId: string; timeZone: string }) {
	if (!input || typeof input.creatorId !== "string" || typeof input.timeZone !== "string") return { ok: false as const, code: "INVALID_INPUT" };
	const { readCreatorOverview } = await import("@/server/creator-overview");
	return readCreatorOverview(input.creatorId, input.timeZone);
}
export async function getCreatorBroadcasts(input: { creatorId: string; after?: string }) {
	if (!input || typeof input.creatorId !== "string" || (input.after !== undefined && typeof input.after !== "string")) return { ok: false as const, code: "INVALID_INPUT" };
	const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
	return readCreatorBroadcasts(input.creatorId, input.after);
}
export async function getCreatorBroadcast(input: { creatorId: string; videoId: string }) {
	if (!input || typeof input.creatorId !== "string" || typeof input.videoId !== "string") return { ok: false as const, code: "INVALID_INPUT" };
	const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
	const result = await readCreatorBroadcasts(input.creatorId, undefined, input.videoId);
	if (!result.ok) return result;
	const broadcast = result.items.find((video) => video.id === input.videoId);
	return broadcast ? { ok: true as const, broadcast, fetchedAt: result.fetchedAt, stale: result.stale } : { ok: false as const, code: "NOT_FOUND" };
}
export async function searchCreatorLibrary(input: { creatorId: string; title: string; cachedOnly?: boolean }) {
	if (!input || typeof input.title !== "string" || input.title.trim().length < 2 || input.title.length > 1000 || (input.cachedOnly !== undefined && typeof input.cachedOnly !== "boolean")) return { ok: false as const, code: "INVALID_INPUT" };
	return getCreatorClipInventory({ creatorId: input.creatorId, query: { title: input.title.trim(), pageSize: 10 }, ...(input.cachedOnly ? { cachedOnly: true } : {}) });
}

export async function refreshCreatorLibrary(input: { creatorId: string }) {
	if (!input || typeof input.creatorId !== "string" || !input.creatorId || input.creatorId.length > 200) return { ok: false as const, code: "INVALID_INPUT" };
	const { authorizeCreatorOperation } = await import("@/auth/authorize-operation");
	const grant = await authorizeCreatorOperation({ creatorId: input.creatorId, resourceOwnerId: input.creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const { getAccessTokenResultInternal } = await import("@/server/tokens");
		if (!(await getAccessTokenResultInternal(input.creatorId)).token) return { ok: false as const, code: "RECONNECT_REQUIRED" };
		const { refreshCreatorClips } = await import("@/server/clip-cache");
		const result = await refreshCreatorClips(input.creatorId);
		return result.ok ? result : { ok: false as const, code: "SYNC_COOLDOWN", nextAllowedAt: result.nextAllowedAt };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}

export async function getCreatorClipDetail(input: { creatorId: string; clipId: string; cachedOnly?: boolean }) {
	if (!input || typeof input.creatorId !== "string" || typeof input.clipId !== "string" || !input.creatorId || !input.clipId || input.creatorId.length > 200 || input.clipId.length > 200 || (input.cachedOnly !== undefined && typeof input.cachedOnly !== "boolean")) return { ok: false as const, code: "INVALID_INPUT" };
	const { readCreatorClipDetail } = await import("@/server/creator-library");
	return input.cachedOnly ? readCreatorClipDetail(input.creatorId, input.clipId, true) : readCreatorClipDetail(input.creatorId, input.clipId);
}

export async function getCreatorClipSelection(input: { creatorId: string; query?: unknown }) {
	if (!input || typeof input.creatorId !== "string" || !input.creatorId || input.creatorId.length > 200) return { ok: false as const, code: "INVALID_INPUT" };
	const { readCreatorClipSelection } = await import("@/server/creator-library");
	return readCreatorClipSelection(input.creatorId, input.query);
}
