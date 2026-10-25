import "server-only";

import { getTwitchCacheByPrefixEntries } from "@actions/database";
import { TwitchCacheType, type TwitchClip } from "@types";

type CachedClipValue = { clip: TwitchClip; unavailable?: boolean; lastValidatedAt?: string };

const configuredStaleMs = Number(process.env.CLIP_VALIDATION_STALE_MS);
const validationStaleMs = Math.max(5 * 60 * 1000, Number.isFinite(configuredStaleMs) && configuredStaleMs > 0 ? Math.floor(configuredStaleMs) : 6 * 60 * 60 * 1000);

/** Internal reader. Callers must authorize the actor or a public resource before exposing results. */
export async function readCachedClipsByOwner(ownerId: string, limit?: number): Promise<TwitchClip[]> {
	const boundedLimit = typeof limit === "number" ? Math.max(1, Math.floor(limit)) : undefined;
	const entries = await getTwitchCacheByPrefixEntries<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, `clip:${ownerId}:`, boundedLimit);
	const deduped = new Map<string, TwitchClip>();
	for (const entry of entries) {
		const value = entry.value;
		if (!value || typeof value !== "object") continue;
		if ((value as CachedClipValue).unavailable) {
			const lastValidatedAt = (value as CachedClipValue).lastValidatedAt;
			const parsed = lastValidatedAt ? Date.parse(lastValidatedAt) : Number.NaN;
			if (Number.isFinite(parsed) && Date.now() - parsed < validationStaleMs) continue;
		}
		const clip = "clip" in value && value.clip ? value.clip : "id" in value && typeof value.id === "string" ? (value as TwitchClip) : null;
		if (!clip?.id || clip.broadcaster_id !== ownerId || deduped.has(clip.id)) continue;
		deduped.set(clip.id, clip);
		if (boundedLimit && deduped.size >= boundedLimit) break;
	}
	return Array.from(deduped.values());
}
