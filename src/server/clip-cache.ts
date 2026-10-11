import "server-only";
import { withoutDatabaseRequest } from "@/db/request-scope";
import { dbPool } from "@/db/client";
import { getTwitchCache } from "@/app/actions/database";
import { getCachedClipsByOwner, getCreatorSyncProgress, syncOwnerClipCache, logTwitchError } from "@/app/actions/twitch";
import { TwitchCacheType } from "@/app/lib/types";
const configuredCooldown = Number(process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS);
export const clipRefreshCooldownMs = Math.max(3600000, Number.isFinite(configuredCooldown) && configuredCooldown > 0 ? Math.floor(configuredCooldown) : 21600000);
const pendingRefreshes = new Set<Promise<void>>();
/** Drain accepted background work before service shutdown or releasing test fixtures. */
export async function drainClipRefreshes() {
	await Promise.all([...pendingRefreshes]);
}
type SyncState = { lastIncrementalSyncAt?: string; lastBackfillSyncAt?: string; rateLimitedUntil?: string };
export async function clipCrawlerStatus(creatorId: string) {
	const [refresh, progress, state, clips] = await Promise.all([getTwitchCache<{ lastForcedAt?: string }>(TwitchCacheType.Clip, `clip-sync-force:${creatorId}`), getCreatorSyncProgress(creatorId), getTwitchCache<SyncState>(TwitchCacheType.Clip, `clip-sync:${creatorId}`), getCachedClipsByOwner(creatorId)]);
	const now = Date.now();
	const lastForcedAt = refresh?.lastForcedAt ?? null;
	const last = lastForcedAt ? Date.parse(lastForcedAt) : NaN;
	const next = Number.isFinite(last) ? last + clipRefreshCooldownMs : now;
	return { creatorId, cachedClipCount: clips.length, ...progress, lastForcedAt, lastIncrementalSyncAt: state?.lastIncrementalSyncAt ?? null, lastBackfillSyncAt: state?.lastBackfillSyncAt ?? null, rateLimitedUntil: state?.rateLimitedUntil ?? null, cooldownMs: clipRefreshCooldownMs, nextAllowedAt: new Date(next).toISOString(), remainingMs: Math.max(0, next - now), canRefresh: now >= next };
}
/** Caller must authorize creator:update. The shared lock serializes dashboard and MCP refresh requests. */
export async function refreshCreatorClips(creatorId: string, ensurePackSize = 0) {
	const connection = await dbPool.connect();
	const key = `clip_refresh_owner:${creatorId}`;
	const syncKey = `clip_sync_owner:${creatorId}`;
	let syncLocked = false;
	try {
		await connection.query("select pg_advisory_lock(hashtext($1))", [key]);
		const status = await clipCrawlerStatus(creatorId);
		if (!status.canRefresh) return { ok: false as const, reason: "cooldown", nextAllowedAt: status.nextAllowedAt, remainingMs: status.remainingMs };
		const lock = await connection.query("select pg_try_advisory_lock(hashtext($1)) as locked", [syncKey]);
		syncLocked = Boolean(lock.rows?.[0]?.locked);
		if (!syncLocked) return { ok: false as const, reason: "in_progress", nextAllowedAt: new Date(Date.now() + 1000).toISOString(), remainingMs: 1000 };
		// Persist the reset and cooldown together; unlike best-effort cache writes, failures must reject acceptance.
		const lastForcedAt = new Date().toISOString();
		await connection.query("BEGIN");
		try {
			await connection.query("DELETE FROM \"twitchCache\" WHERE type='clip' AND key=$1", [`clip-sync:${creatorId}`]);
			await connection.query("INSERT INTO \"twitchCache\"(type,key,value,fetched_at,expires_at) VALUES('clip',$1,$2,now(),NULL) ON CONFLICT(type,key) DO UPDATE SET value=excluded.value,fetched_at=excluded.fetched_at,expires_at=NULL", [`clip-sync-force:${creatorId}`, JSON.stringify({ lastForcedAt })]);
			await connection.query("COMMIT");
		} catch (error) {
			await connection.query("ROLLBACK");
			throw error;
		}
		await connection.query("select pg_advisory_unlock(hashtext($1))", [syncKey]);
		syncLocked = false;
		const pending = withoutDatabaseRequest(() => syncOwnerClipCache(creatorId, ensurePackSize)).catch((error) => logTwitchError("refreshCreatorClips", error));
		pendingRefreshes.add(pending);
		void pending.finally(() => pendingRefreshes.delete(pending));
		return { ok: true as const, accepted: true, lastForcedAt, cooldownMs: clipRefreshCooldownMs, nextAllowedAt: new Date(Date.parse(lastForcedAt) + clipRefreshCooldownMs).toISOString(), remainingMs: clipRefreshCooldownMs };
	} finally {
		try {
			if (syncLocked) await connection.query("select pg_advisory_unlock(hashtext($1))", [syncKey]);
			await connection.query("select pg_advisory_unlock(hashtext($1))", [key]);
		} finally {
			connection.release();
		}
	}
}
