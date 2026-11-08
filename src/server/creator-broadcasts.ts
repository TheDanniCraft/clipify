import { broadcastVideoSchema, saveBroadcasts, readSavedBroadcasts, markBroadcastUnavailable, ensureBroadcastCollection, type SavedBroadcast } from "./broadcast-archive";
import { publicClip } from "./resources/clip-discovery";
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { readCreatorLibrary } from "./creator-library";
import { getAccessTokenResultInternal } from "./tokens";
import { getTwitchCacheEntry, setTwitchCache } from "@actions/database";
import { TwitchCacheType } from "@types";
import { publicTwitchImageUrl } from "./resources/twitch-image";
import { readBoundedResponse } from "@lib/clipExport";
function cursorSignature(payload: string) {
	const key = process.env.JWT_SECRET;
	if (!key) throw new Error("SERVICE_UNAVAILABLE");
	return createHmac("sha256", key).update(payload).digest("base64url");
}
export function sealBroadcastCursor(creatorId: string, after: string) {
	const payload = Buffer.from(JSON.stringify({ creatorId, after })).toString("base64url");
	const cursor = `${payload}.${cursorSignature(payload)}`;
	if (cursor.length > 2048) throw new Error("INVALID_INPUT");
	return cursor;
}
export function parseBroadcastCursor(cursor: string | undefined, creatorId: string): string | undefined {
	if (cursor === undefined) return undefined;
	if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)) throw new Error("INVALID_INPUT");
	const [payload, signature] = cursor.split(".");
	const expected = Buffer.from(cursorSignature(payload));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("INVALID_INPUT");
	const parsed = z.object({ creatorId: z.literal(creatorId), after: z.string().min(1).max(1024) }).safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
	if (!parsed.success) throw new Error("INVALID_INPUT");
	return parsed.data.after;
}

const videoSchema = broadcastVideoSchema;
const pageSchema = z.object({ data: z.array(videoSchema).max(100), after: z.string().max(1024).optional(), fetchedAt: z.string().datetime() });
function matchesBroadcast(video: z.infer<typeof videoSchema>, creatorId: string, videoId?: string) {
	return video.user_id === creatorId && video.type === "archive" && (!videoId || video.id === videoId);
}
async function fetchBroadcastPage(creatorId: string, videoId: string | undefined, providerAfter: string | undefined) {
	const credentials = await getAccessTokenResultInternal(creatorId);
	if (!credentials.token) throw new Error("RECONNECT_REQUIRED");
	const url = new URL("https://api.twitch.tv/helix/videos");
	if (videoId) url.searchParams.set("id", videoId);
	else {
		url.searchParams.set("user_id", creatorId);
		url.searchParams.set("type", "archive");
		url.searchParams.set("first", "100");
		if (providerAfter) url.searchParams.set("after", providerAfter);
	}
	const signal = AbortSignal.timeout(5000);
	const response = await fetch(url, { headers: { Authorization: `Bearer ${credentials.token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal, redirect: "error" });
	if (!response.ok) {
		await response.body?.cancel();
		if (videoId && response.status === 404) throw new Error("NOT_FOUND");
		throw new Error(response.status === 401 ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE");
	}
	const payload = z.object({ data: z.array(videoSchema).max(100), pagination: z.object({ cursor: z.string().max(1024).optional() }).optional() }).parse(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 1024 * 1024, signal))));
	return { data: payload.data.filter((video) => matchesBroadcast(video, creatorId, videoId)), after: payload.pagination?.cursor, fetchedAt: new Date().toISOString() };
}
async function cachedBroadcastPage(creatorId: string, key: string, videoId: string | undefined, providerAfter: string | undefined) {
	const cached = await getTwitchCacheEntry<unknown>(TwitchCacheType.User, key);
	const stored = pageSchema.safeParse(cached.value);
	let page = stored.success ? stored.data : null;
	let stale = false;
	let missing = false;
	if (page) await saveBroadcasts(creatorId, page.data, page.fetchedAt);
	if (!page || Date.now() - Date.parse(page.fetchedAt) >= 5 * 60000) {
		try {
			page = await fetchBroadcastPage(creatorId, videoId, providerAfter);
			await setTwitchCache(TwitchCacheType.User, key, page, 24 * 60 * 60);
			await saveBroadcasts(creatorId, page.data, page.fetchedAt);
		} catch (error) {
			if (error instanceof Error && error.message === "NOT_FOUND") {
				missing = true;
				if (!page) return { ok: false as const, code: "NOT_FOUND" };
			}
			if (!page) return { ok: false as const, code: error instanceof Error && error.message === "RECONNECT_REQUIRED" ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE" };
			stale = true;
		}
	}
	return { ok: true as const, page, stale, missing };
}
function mergeBroadcasts(creatorId: string, saved: SavedBroadcast[], page: z.infer<typeof pageSchema> | undefined) {
	const catalog = new Map<string, SavedBroadcast>(saved.map((record) => [record.video.id, record]));
	if (page)
		for (const video of page.data) {
			if (!matchesBroadcast(video, creatorId)) continue;
			const existing = catalog.get(video.id);
			if (!existing || existing.lastSeenAt < page.fetchedAt) catalog.set(video.id, { video, lastSeenAt: page.fetchedAt, unavailable: false });
		}
	return catalog;
}
async function readBroadcastCatalog(creatorId: string, providerCursor: string | undefined, videoId?: string) {
	await ensureBroadcastCollection(creatorId);
	const key = `broadcasts:${creatorId}:${videoId ? `video-${videoId}` : (providerCursor ?? "first")}`;
	const cachedPage = await cachedBroadcastPage(creatorId, key, videoId, providerCursor);
	const saved = await readSavedBroadcasts(creatorId);
	if (!cachedPage.ok && !saved.length) return cachedPage;
	const catalog = mergeBroadcasts(creatorId, saved, cachedPage.ok ? cachedPage.page : undefined);
	const missing = videoId && ((!cachedPage.ok && cachedPage.code === "NOT_FOUND") || (cachedPage.ok && (cachedPage.missing || !cachedPage.page.data.length)));
	if (missing && catalog.has(videoId)) {
		await markBroadcastUnavailable(creatorId, videoId);
		catalog.get(videoId)!.unavailable = true;
	}
	const stale = !cachedPage.ok || cachedPage.stale;
	const fetchedAt = cachedPage.ok
		? cachedPage.page.fetchedAt
		: saved
				.map((record) => record.lastSeenAt)
				.sort()
				.at(-1)!;

	return { ok: true as const, records: [...catalog.values()], stale, fetchedAt };
}

export async function readCreatorBroadcasts(creatorId: string, after?: string, videoId?: string) {
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	let providerAfter: string | undefined;
	try {
		providerAfter = parseBroadcastCursor(after, creatorId);
		if (providerAfter?.startsWith("saved:") && !/^saved:\d{1,200}$/.test(providerAfter)) throw new Error("INVALID_INPUT");
		if (videoId !== undefined && !/^\d{1,200}$/.test(videoId)) throw new Error("INVALID_INPUT");
	} catch {
		return { ok: false as const, code: "INVALID_INPUT" };
	}
	try {
		const localAfter = providerAfter?.startsWith("saved:") ? providerAfter.slice(6) : undefined;
		const providerCursor = localAfter ? undefined : providerAfter;
		const catalog = await readBroadcastCatalog(creatorId, providerCursor, videoId);
		if (!catalog.ok) return catalog;

		const ordered = catalog.records.filter((record) => matchesBroadcast(record.video, creatorId, videoId)).sort((a, b) => Date.parse(b.video.created_at) - Date.parse(a.video.created_at) || a.video.id.localeCompare(b.video.id));
		const start = localAfter ? ordered.findIndex((record) => record.video.id === localAfter) + 1 : 0;
		if (localAfter && !start) return { ok: false as const, code: "INVALID_INPUT" };
		const visible = ordered.slice(start, start + 20);

		const library = await readCreatorLibrary(creatorId);
		const clips = library.ok ? library.clips : [];
		const items = visible.map(({ video, unavailable }) => {
			const matching = clips.filter((clip) => clip.video_id === video.id);
			return {
				moments: matching
					.slice()
					.sort((a, b) => (a.vod_offset ?? Infinity) - (b.vod_offset ?? Infinity) || Date.parse(a.created_at) - Date.parse(b.created_at))
					.slice(0, videoId ? matching.length : 8)
					.map(publicClip),
				available: !unavailable,
				id: video.id,
				title: video.title,
				createdAt: video.created_at,
				duration: video.duration,
				url: `https://www.twitch.tv/videos/${video.id}`,
				thumbnailUrl:
					(unavailable ? null : publicTwitchImageUrl(video.thumbnail_url?.replace(/%\{width\}/g, "320").replace(/%\{height\}/g, "180"))) ??
					matching
						.toSorted((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
						.map((clip) => publicTwitchImageUrl(clip.thumbnail_url))
						.find(Boolean) ??
					null,
				clipCount: library.ok ? matching.length : null,
				clipViews: library.ok ? matching.reduce((sum, clip) => sum + (clip.view_count ?? 0), 0) : null,
			};
		});
		return { ok: true as const, items, nextCursor: start + 20 < ordered.length && !videoId ? sealBroadcastCursor(creatorId, `saved:${visible.at(-1)!.video.id}`) : null, fetchedAt: catalog.fetchedAt, stale: catalog.stale };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
