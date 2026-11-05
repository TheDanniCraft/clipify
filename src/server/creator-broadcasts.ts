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

const videoSchema = z.object({ id: z.string().regex(/^\d+$/).max(200), user_id: z.string().min(1).max(200), title: z.string().max(1000), created_at: z.string().datetime(), type: z.string(), duration: z.string().max(100), thumbnail_url: z.string().optional() });
const pageSchema = z.object({ data: z.array(videoSchema).max(20), after: z.string().max(1024).optional(), fetchedAt: z.string().datetime() });
export async function readCreatorBroadcasts(creatorId: string, after?: string, videoId?: string) {
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	let providerAfter: string | undefined;
	try {
		providerAfter = parseBroadcastCursor(after, creatorId);
		if (videoId !== undefined && !/^\d{1,200}$/.test(videoId)) throw new Error("INVALID_INPUT");
	} catch {
		return { ok: false as const, code: "INVALID_INPUT" };
	}
	const key = `broadcasts:${creatorId}:${videoId ? `video-${videoId}` : (after ?? "first")}`;
	const cached = await getTwitchCacheEntry<unknown>(TwitchCacheType.User, key);
	const stored = pageSchema.safeParse(cached.value);
	let page = stored.success ? stored.data : null;
	let stale = false;
	if (!page || Date.now() - Date.parse(page.fetchedAt) >= 5 * 60000) {
		try {
			const credentials = await getAccessTokenResultInternal(creatorId);
			if (!credentials.token) throw new Error("RECONNECT_REQUIRED");
			const url = new URL("https://api.twitch.tv/helix/videos");
			if (videoId) url.searchParams.set("id", videoId);
			else {
				url.searchParams.set("user_id", creatorId);
				url.searchParams.set("type", "archive");
				url.searchParams.set("first", "20");
				if (providerAfter) url.searchParams.set("after", providerAfter);
			}
			const signal = AbortSignal.timeout(5000);
			const response = await fetch(url, { headers: { Authorization: `Bearer ${credentials.token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal, redirect: "error" });
			if (!response.ok) {
				await response.body?.cancel();
				if (videoId && response.status === 404) return { ok: false as const, code: "NOT_FOUND" };
				throw new Error(response.status === 401 ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE");
			}
			const payload = z.object({ data: z.array(videoSchema).max(20), pagination: z.object({ cursor: z.string().max(1024).optional() }).optional() }).parse(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 1024 * 1024, signal))));
			page = { data: payload.data.filter((video) => video.user_id === creatorId && video.type === "archive" && (!videoId || video.id === videoId)), after: payload.pagination?.cursor, fetchedAt: new Date().toISOString() };
			await setTwitchCache(TwitchCacheType.User, key, page, 24 * 60 * 60);
		} catch (error) {
			if (!page) return { ok: false as const, code: error instanceof Error && error.message === "RECONNECT_REQUIRED" ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE" };
			stale = true;
		}
	}
	const library = await readCreatorLibrary(creatorId);
	const clips = library.ok ? library.clips : [];
	const items = page.data
		.filter((video) => video.user_id === creatorId && video.type === "archive" && (!videoId || video.id === videoId))
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id))
		.map((video) => {
			const matching = clips.filter((clip) => clip.video_id === video.id);
			return {
				moments: matching
					.slice()
					.sort((a, b) => (a.vod_offset ?? Infinity) - (b.vod_offset ?? Infinity) || Date.parse(a.created_at) - Date.parse(b.created_at))
					.slice(0, 8)
					.map(publicClip),
				id: video.id,
				title: video.title,
				createdAt: video.created_at,
				duration: video.duration,
				url: `https://www.twitch.tv/videos/${video.id}`,
				thumbnailUrl: publicTwitchImageUrl(video.thumbnail_url?.replace(/%\{width\}/g, "320").replace(/%\{height\}/g, "180")),
				clipCount: library.ok ? matching.length : null,
				clipViews: library.ok ? matching.reduce((sum, clip) => sum + (clip.view_count ?? 0), 0) : null,
			};
		});
	return { ok: true as const, items, nextCursor: page.after && !videoId ? sealBroadcastCursor(creatorId, page.after) : null, fetchedAt: page.fetchedAt, stale };
}
