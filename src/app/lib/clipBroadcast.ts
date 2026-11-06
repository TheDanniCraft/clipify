import { z } from "zod";
const identity = z.object({ id: z.string(), broadcaster_id: z.string(), video_id: z.string().max(200).optional(), vod_offset: z.number().finite().nonnegative().nullable().optional() });
const reference = z.object({ id: z.string().min(1).max(200), offset: z.number().finite().nonnegative().nullable() });
export type ClipBroadcastReference = z.infer<typeof reference>;
type ClipIdentity = z.infer<typeof identity>;
export function rememberClipBroadcast(clip: ClipIdentity, previous?: unknown): ClipBroadcastReference | undefined {
	const stored = previous && typeof previous === "object" ? (previous as { clip?: unknown; broadcast?: unknown }) : undefined;
	const prior = identity.safeParse(stored?.clip ?? previous);
	const same = prior.success && prior.data.id === clip.id && prior.data.broadcaster_id === clip.broadcaster_id;
	const saved = same ? reference.safeParse(stored?.broadcast) : undefined;
	const earlier = saved?.success ? saved.data : same && prior.data.video_id ? { id: prior.data.video_id, offset: prior.data.vod_offset ?? null } : undefined;
	if (clip.video_id) {
		const current = reference.safeParse({ id: clip.video_id, offset: clip.vod_offset ?? (earlier?.id === clip.video_id ? earlier.offset : null) });
		return current.success ? current.data : undefined;
	}
	return earlier;
}
export function withClipBroadcast<T extends ClipIdentity>(clip: T, stored: unknown): T {
	const saved = rememberClipBroadcast(clip, stored);
	return saved ? { ...clip, video_id: saved.id, vod_offset: clip.vod_offset ?? saved.offset } : clip;
}
