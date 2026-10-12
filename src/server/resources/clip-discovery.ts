import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { discoveryFilters } from "@/server/mcp/workflows/schemas";
export type ClipFilters = Partial<z.infer<typeof discoveryFilters>>;
export type DiscoverableClip = { id: string; title: string; created_at: string; game_id?: string; view_count?: number; duration: number };
export function filterDiscoveredClips<T extends DiscoverableClip>(clips: T[], filters: ClipFilters, categoryId?: string): T[] {
	return clips
		.filter(
			(clip) =>
				(!categoryId || clip.game_id === categoryId) &&
				(!filters.title || clip.title.toLocaleLowerCase("en").includes(filters.title.toLocaleLowerCase("en"))) &&
				(!filters.startedAt || Date.parse(clip.created_at) >= Date.parse(filters.startedAt)) &&
				(!filters.endedAt || Date.parse(clip.created_at) < Date.parse(filters.endedAt)) &&
				(filters.minViews === undefined || (clip.view_count ?? 0) >= filters.minViews) &&
				(filters.minDuration === undefined || clip.duration >= filters.minDuration) &&
				(filters.maxDuration === undefined || clip.duration <= filters.maxDuration),
		)
		.sort((left, right) => (filters.sort === "most_viewed" ? (right.view_count ?? 0) - (left.view_count ?? 0) : Date.parse(right.created_at) - Date.parse(left.created_at)) || left.id.localeCompare(right.id));
}

import { z as schema } from "zod";
import { providerClipSchema } from "./clip-validation";
import { publicTwitchImageUrl } from "./twitch-image";
export function publicClip(clip: schema.infer<typeof providerClipSchema>) {
	const thumbnailUrl = publicTwitchImageUrl(clip.thumbnail_url);
	return { id: clip.id, title: clip.title, url: `https://clips.twitch.tv/${encodeURIComponent(clip.id)}`, categoryId: clip.game_id ?? null, createdAt: clip.created_at, views: clip.view_count ?? 0, duration: clip.duration, thumbnailUrl };
}
export async function fetchClipDiscovery(creatorId: string, filters: ClipFilters) {
	const { getCachedClipsByOwner, getCreatorSyncProgress } = await import("@/app/actions/twitch");
	const { getTwitchCacheBatch } = await import("@/app/actions/database");
	const { TwitchCacheType } = await import("@/app/lib/types");
	try {
		const [cached, progress] = await Promise.all([getCachedClipsByOwner(creatorId), getCreatorSyncProgress(creatorId)]);
		const parsed = schema.array(providerClipSchema).safeParse(cached);
		if (!parsed.success || parsed.data.some((clip) => clip.broadcaster_id !== creatorId)) throw new Error("SERVICE_UNAVAILABLE");
		const clips = Array.from(new Map(parsed.data.map((clip) => [clip.id, clip])).values());
		const snapshot = createHash("sha256")
			.update(JSON.stringify([...clips].sort((a, b) => a.id.localeCompare(b.id))))
			.digest("hex");
		let categoryId = filters.category;
		if (categoryId && !/^\d+$/.test(categoryId)) {
			const categoryIds = [...new Set(clips.map((clip) => clip.game_id).filter((id): id is string => Boolean(id)))];
			const games = await getTwitchCacheBatch<{ id: string; name: string }>(TwitchCacheType.Game, categoryIds);
			categoryId = games.find((game) => game?.name?.toLocaleLowerCase("en") === filters.category!.toLocaleLowerCase("en"))?.id;
			if (!categoryId) return { clips: [], snapshot, providerAfter: undefined, scanned: clips.length, complete: progress.isSyncComplete && categoryIds.every((id) => games.some((game) => game?.id === id)) };
		}
		return { clips: filterDiscoveredClips(clips, filters, categoryId), snapshot, providerAfter: undefined, scanned: clips.length, complete: progress.isSyncComplete };
	} catch {
		throw new Error("SERVICE_UNAVAILABLE");
	}
}
