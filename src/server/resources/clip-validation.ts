import "server-only";
import { z } from "zod";
import { getAccessTokenInternal } from "@/server/tokens";

export const providerClipSchema = z.object({
	id: z.string().min(1).max(200),
	title: z.string().max(1000),
	duration: z.number().finite().min(0).max(600),
	broadcaster_id: z.string().min(1).max(200),
	created_at: z.string().datetime(),
	url: z.string().url().max(2048).optional(),
	embed_url: z.string().url().max(2048).optional(),
	broadcaster_name: z.string().max(200).optional(),
	creator_id: z.string().max(200).optional(),
	creator_name: z.string().max(200).optional(),
	video_id: z.string().max(200).optional(),
	game_id: z.string().max(200).optional(),
	language: z.string().max(32).optional(),
	view_count: z.number().int().nonnegative().optional(),
	thumbnail_url: z.string().url().max(2048).optional(),
	vod_offset: z.number().nonnegative().nullable().optional(),
	is_featured: z.boolean().optional(),
});

/** Reuse validated creator cache entries; resolve only uncached explicit IDs through Twitch. */
export async function resolveValidatedPlaylistClips(creatorId: string, clipIds: string[]) {
	const { getCachedClipsByOwner } = await import("@/app/actions/twitch");
	const requestedIds = new Set(clipIds);
	const resolved = new Map<string, z.infer<typeof providerClipSchema>>();
	for (const clip of await getCachedClipsByOwner(creatorId)) {
		if (!requestedIds.has(clip.id)) continue;
		const parsed = providerClipSchema.safeParse(clip);
		if (!parsed.success || parsed.data.broadcaster_id !== creatorId) throw new Error("INVALID_INPUT");
		resolved.set(parsed.data.id, parsed.data);
	}
	const missingIds = clipIds.filter((id) => !resolved.has(id));
	if (!missingIds.length) return clipIds.map((id) => resolved.get(id)!);
	const token = await getAccessTokenInternal(creatorId);
	const clientId = process.env.TWITCH_CLIENT_ID;
	if (!token || !clientId) throw new Error("SERVICE_UNAVAILABLE");
	const signal = AbortSignal.timeout(5000);
	for (let offset = 0; offset < missingIds.length; offset += 100) {
		const requested = missingIds.slice(offset, offset + 100);
		const url = new URL("https://api.twitch.tv/helix/clips");
		for (const id of requested) url.searchParams.append("id", id);
		let payload: unknown;
		try {
			const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": clientId }, signal, redirect: "error" });
			if (!response.ok) throw new Error("SERVICE_UNAVAILABLE");
			payload = await response.json();
		} catch {
			throw new Error("SERVICE_UNAVAILABLE");
		}
		const parsed = z.object({ data: z.array(providerClipSchema).max(100) }).safeParse(payload);
		if (!parsed.success || parsed.data.data.length !== requested.length) throw new Error("INVALID_INPUT");
		for (const clip of parsed.data.data) {
			if (!requested.includes(clip.id) || resolved.has(clip.id)) throw new Error("INVALID_INPUT");
			resolved.set(clip.id, clip);
		}
	}
	return clipIds.map((id) => {
		const clip = resolved.get(id);
		if (!clip) throw new Error("INVALID_INPUT");
		return clip;
	});
}
