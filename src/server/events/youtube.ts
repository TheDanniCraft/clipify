import "server-only";
import { z } from "zod";
import { eventGoogleToken } from "./connections";
import { requestProviderJson } from "@/server/runner/provider-api";
import { EventError } from "./persistence";
import type { EventCandidateContent } from "@lib/eventCandidates";
export function parseAwardYoutubeReference(reference: string) {
	if (/^[A-Za-z0-9_-]{11}$/.test(reference)) return reference;
	try {
		const url = new URL(reference.trim());
		if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error();
		const parts = url.pathname.split("/").filter(Boolean);
		const id = url.hostname === "youtu.be" && parts.length === 1 ? parts[0] : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) ? (url.pathname === "/watch" ? url.searchParams.get("v") : ["shorts", "live", "embed"].includes(parts[0]) && parts.length === 2 ? parts[1] : null) : null;
		if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error();
		return id;
	} catch {
		throw new EventError("INVALID_INPUT");
	}
}
const videoSchema = z.object({
	id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
	snippet: z.object({ title: z.string().min(1).max(160), channelId: z.string(), channelTitle: z.string().optional(), publishedAt: z.iso.datetime({ offset: true }), thumbnails: z.object({ high: z.object({ url: z.url() }).optional(), medium: z.object({ url: z.url() }).optional(), default: z.object({ url: z.url() }).optional() }) }),
	statistics: z.object({ viewCount: z.string().regex(/^\d+$/) }),
	contentDetails: z.object({ duration: z.string() }),
	status: z.object({ privacyStatus: z.string(), embeddable: z.boolean() }),
});
function durationSeconds(duration: string) {
	const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(duration);
	if (!match) throw new EventError("INVALID_INPUT");
	return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}
function content(raw: unknown, channelId: string): EventCandidateContent {
	const parsed = videoSchema.safeParse(raw);
	if (!parsed.success) throw new EventError("INVALID_INPUT");
	const video = parsed.data;
	const views = Number(video.statistics.viewCount);
	if (video.snippet.channelId !== channelId || video.status.privacyStatus !== "public" || !video.status.embeddable || !Number.isSafeInteger(views)) throw new EventError("INVALID_INPUT");
	const thumbnail = video.snippet.thumbnails.high ?? video.snippet.thumbnails.medium ?? video.snippet.thumbnails.default;
	return { kind: "youtube", reference: video.id, title: video.snippet.title, description: "", creatorId: channelId, createdAt: video.snippet.publishedAt, views, duration: durationSeconds(video.contentDetails.duration), ...(thumbnail ? { thumbnailUrl: thumbnail.url } : {}) };
}
async function videos(ownerId: string, ids: string[]) {
	const { connection, accessToken } = await eventGoogleToken(ownerId, "youtube");
	const url = new URL("https://www.googleapis.com/youtube/v3/videos");
	url.searchParams.set("part", "snippet,statistics,contentDetails,status");
	url.searchParams.set("id", ids.join(","));
	const response = z.object({ items: z.array(z.unknown()).max(50) }).parse(await requestProviderJson(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } }));
	return response.items
		.map((item) => {
			try {
				return content(item, connection.identityId);
			} catch {
				return null;
			}
		})
		.filter((item): item is EventCandidateContent => item !== null);
}
export async function resolveAwardYoutube(ownerId: string, reference: string) {
	const id = parseAwardYoutubeReference(reference);
	const items = await videos(ownerId, [id]);
	const item = items.find((item) => item.reference === id);
	if (!item) throw new EventError("INVALID_INPUT");
	return item;
}
export async function searchAwardYoutube(ownerId: string, query: string) {
	if (query.length > 2048) throw new EventError("INVALID_INPUT");
	if (/^https?:\/\//i.test(query.trim())) return [await resolveAwardYoutube(ownerId, query)];
	if (query.trim().length < 2) return [];
	const { connection, accessToken } = await eventGoogleToken(ownerId, "youtube");
	const url = new URL("https://www.googleapis.com/youtube/v3/search");
	for (const [key, value] of Object.entries({ part: "snippet", type: "video", channelId: connection.identityId, q: query.trim(), maxResults: "25", videoEmbeddable: "true" })) url.searchParams.set(key, value);
	const response = z.object({ items: z.array(z.object({ id: z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }) })).max(25) }).parse(await requestProviderJson(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } }));
	return response.items.length
		? videos(
				ownerId,
				response.items.map((item) => item.id.videoId),
			)
		: [];
}
