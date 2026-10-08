import "server-only";
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
export function publicClip(clip: schema.infer<typeof providerClipSchema>) {
	let thumbnailUrl: string | null = null;
	if (clip.thumbnail_url) {
		try {
			const url = new URL(clip.thumbnail_url);
			if (url.protocol === "https:" && !url.username && !url.password && (url.hostname.endsWith(".jtvnw.net") || url.hostname.endsWith(".twitchcdn.net"))) thumbnailUrl = url.href;
		} catch {}
	}
	return { id: clip.id, title: clip.title, url: `https://clips.twitch.tv/${encodeURIComponent(clip.id)}`, categoryId: clip.game_id ?? null, createdAt: clip.created_at, views: clip.view_count ?? 0, duration: clip.duration, thumbnailUrl };
}
export async function fetchClipDiscovery(creatorId: string, filters: ClipFilters, after?: string) {
	const { getAccessTokenInternal } = await import("@/server/tokens");
	const token = await getAccessTokenInternal(creatorId);
	const clientId = process.env.TWITCH_CLIENT_ID;
	if (!token || !clientId) throw new Error("SERVICE_UNAVAILABLE");
	const signal = AbortSignal.timeout(5000);
	const request = async (url: URL) => {
		try {
			const response = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": clientId }, signal, redirect: "error" });
			if (!response.ok) throw new Error();
			return await response.json();
		} catch {
			throw new Error("SERVICE_UNAVAILABLE");
		}
	};
	async function resolveDiscoveryCategory() {
		let categoryId: string | undefined;
		if (filters.category) {
			if (/^\d+$/.test(filters.category)) categoryId = filters.category;
			else {
				const url = new URL("https://api.twitch.tv/helix/games");
				url.searchParams.set("name", filters.category);
				const result = schema.object({ data: schema.array(schema.object({ id: schema.string().min(1).max(200), name: schema.string().max(200) })).max(100) }).safeParse(await request(url));
				if (!result.success) throw new Error("SERVICE_UNAVAILABLE");
				categoryId = result.data.data.find((game) => game.name.toLocaleLowerCase("en") === filters.category!.toLocaleLowerCase("en"))?.id;
			}
		}
		return categoryId;
	}
	const categoryId = await resolveDiscoveryCategory();
	if (filters.category && !categoryId) return { clips: [], providerAfter: undefined, scanned: 0, complete: true };
	const clips: schema.infer<typeof providerClipSchema>[] = [];
	const seen = new Set<string>();
	let cursor = after;
	const seenCursors = new Set<string>();
	if (after) seenCursors.add(after);
	for (let page = 0; page < 5; page++) {
		const url = new URL("https://api.twitch.tv/helix/clips");
		url.searchParams.set("broadcaster_id", creatorId);
		url.searchParams.set("first", "100");
		if (cursor) url.searchParams.set("after", cursor);
		if (filters.startedAt) url.searchParams.set("started_at", filters.startedAt);
		if (filters.endedAt) url.searchParams.set("ended_at", filters.endedAt);
		const result = schema.object({ data: schema.array(providerClipSchema).max(100), pagination: schema.object({ cursor: schema.string().min(1).max(128).optional() }).optional() }).safeParse(await request(url));
		if (!result.success || result.data.data.some((clip) => clip.broadcaster_id !== creatorId || seen.has(clip.id))) throw new Error("SERVICE_UNAVAILABLE");
		for (const clip of result.data.data) {
			if (seen.has(clip.id)) throw new Error("SERVICE_UNAVAILABLE");
			seen.add(clip.id);
			clips.push(clip);
		}
		cursor = result.data.pagination?.cursor;
		if (!cursor) break;
		if (seenCursors.has(cursor)) throw new Error("SERVICE_UNAVAILABLE");
		seenCursors.add(cursor);
	}
	return { clips: filterDiscoveredClips(clips, filters, categoryId), providerAfter: cursor, scanned: clips.length, complete: !cursor };
}
