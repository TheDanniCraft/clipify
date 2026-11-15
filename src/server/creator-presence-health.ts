import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { QueryClient } from "@/db/client";
import { twitchCacheTable } from "@/db/schema";
import { TwitchCacheType } from "@/app/lib/types";
import { COMMUNITY_SNAPSHOT_CACHE_KEY, COMMUNITY_SNAPSHOT_MAX_AGE_MS } from "@/app/lib/community-presence-contract";
import { getActiveOverlayOwnerIds } from "@/app/store/overlaySubscribers";

const snapshotSchema = z.object({
	streamers: z.array(z.object({ id: z.string().min(1), status: z.enum(["live_with_overlay", "live", "offline"]) })),
	totalCount: z.number().int().nonnegative(),
	liveStatusKnownCount: z.number().int().nonnegative(),
	updatedAt: z.string().datetime(),
});

export type CreatorPresenceHealth = {
	twitchOnline: number | null;
	twitchOffline: number | null;
	twitchUnknown: number;
	twitchSnapshotFresh: number;
	twitchSnapshotAgeSeconds: number | null;
	connectedCreators: number;
	onlineUsingClipify: number | null;
};

/** Shared Twitch observations, with distinct active player owners on this instance. */
export async function getCreatorPresenceHealth(db: QueryClient, enabledCreators: number, now = new Date()): Promise<CreatorPresenceHealth> {
	const activeOwners = getActiveOverlayOwnerIds();
	const [cached] = await db
		.select({ value: twitchCacheTable.value, expiresAt: twitchCacheTable.expiresAt })
		.from(twitchCacheTable)
		.where(and(eq(twitchCacheTable.type, TwitchCacheType.User), eq(twitchCacheTable.key, COMMUNITY_SNAPSHOT_CACHE_KEY)))
		.limit(1);
	let snapshot: z.infer<typeof snapshotSchema> | undefined;
	try {
		const parsed = snapshotSchema.safeParse(JSON.parse(cached?.value ?? "null"));
		if (parsed.success) snapshot = parsed.data;
	} catch {
		// An invalid cache is unavailable status, never evidence that creators went offline.
	}
	const age = snapshot ? now.getTime() - Date.parse(snapshot.updatedAt) : null;
	const live = snapshot?.streamers.filter((streamer) => streamer.status !== "offline") ?? [];
	const valid = snapshot && snapshot.totalCount === snapshot.streamers.length && new Set(snapshot.streamers.map((streamer) => streamer.id)).size === snapshot.totalCount && snapshot.liveStatusKnownCount >= live.length && snapshot.liveStatusKnownCount <= snapshot.totalCount;
	const fresh = Boolean(valid && age !== null && age >= 0 && age < COMMUNITY_SNAPSHOT_MAX_AGE_MS && cached?.expiresAt && cached.expiresAt > now);
	return {
		twitchOnline: fresh ? live.length : null,
		twitchOffline: fresh ? snapshot!.liveStatusKnownCount - live.length : null,
		twitchUnknown: fresh ? snapshot!.totalCount - snapshot!.liveStatusKnownCount : Math.max(0, enabledCreators),
		twitchSnapshotFresh: fresh ? 1 : 0,
		twitchSnapshotAgeSeconds: age !== null && age >= 0 ? Math.floor(age / 1000) : null,
		connectedCreators: activeOwners.size,
		onlineUsingClipify: fresh ? live.filter((streamer) => activeOwners.has(streamer.id)).length : null,
	};
}
