import "server-only";
import { withoutDatabaseRequest } from "@/db/request-scope";
import { dbPool, type TransactionClient } from "@/db/client";
import { getTwitchCache } from "@/app/actions/database";
import { getCreatorSyncProgress, logTwitchError } from "@/app/actions/twitch";
import { readCachedClipsByOwner } from "@/server/clip-cache-read";
import { crawlTransactionConnection } from "./clip-crawler/transaction";
import { enqueueManualClipCrawl } from "./clip-crawler/queue";
import { runClipCrawlerBatch } from "./clip-crawler/worker";
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
	const [refresh, progress, state, clips, jobs] = await Promise.all([
		getTwitchCache<{ lastForcedAt?: string }>(TwitchCacheType.Clip, `clip-sync-force:${creatorId}`),
		getCreatorSyncProgress(creatorId),
		getTwitchCache<SyncState>(TwitchCacheType.Clip, `clip-sync:${creatorId}`),
		readCachedClipsByOwner(creatorId),
		dbPool.query(
			`SELECT kind,
 CASE WHEN lease_expires_at>now() THEN 'running' WHEN next_run_at IS NULL THEN 'complete'
 WHEN requested_at IS NOT NULL OR next_run_at<=now() THEN 'queued' ELSE 'scheduled' END AS status,
 next_run_at, last_completed_at, failures FROM clip_crawl_jobs WHERE creator_id=$1 ORDER BY kind`,
			[creatorId],
		),
	]);
	const now = Date.now();
	const lastForcedAt = refresh?.lastForcedAt ?? null;
	const last = lastForcedAt ? Date.parse(lastForcedAt) : NaN;
	const next = Number.isFinite(last) ? last + clipRefreshCooldownMs : now;
	return {
		creatorId,
		jobs: jobs.rows.map((job) => ({ kind: job.kind, status: job.status, nextRunAt: job.next_run_at?.toISOString() ?? null, lastCompletedAt: job.last_completed_at?.toISOString() ?? null, failures: job.failures })),
		cachedClipCount: clips.length,
		...progress,
		lastForcedAt,
		lastIncrementalSyncAt: state?.lastIncrementalSyncAt ?? null,
		lastBackfillSyncAt: state?.lastBackfillSyncAt ?? null,
		rateLimitedUntil: state?.rateLimitedUntil ?? null,
		cooldownMs: clipRefreshCooldownMs,
		nextAllowedAt: new Date(next).toISOString(),
		remainingMs: Math.max(0, next - now),
		canRefresh: now >= next,
	};
}
/** Caller must authorize creator:update. Queue writes share the MCP authorization transaction. */
export async function refreshCreatorClips(creatorId: string, context?: { tx: TransactionClient; afterCommit: (callback: () => void) => void }) {
	const owned = context ? null : await dbPool.connect();
	const connection = context ? crawlTransactionConnection(context.tx) : owned!;
	const key = `clip_refresh_owner:${creatorId}`;
	try {
		await connection.query(context ? "select pg_advisory_xact_lock(hashtext($1))" : "select pg_advisory_lock(hashtext($1))", [key]);
		const marker = (await connection.query("SELECT value FROM \"twitchCache\" WHERE type='clip' AND key=$1", [`clip-sync-force:${creatorId}`])).rows[0];
		const last = marker ? Date.parse(JSON.parse(marker.value).lastForcedAt) : NaN;
		const next = last + clipRefreshCooldownMs;
		if (Number.isFinite(next) && Date.now() < next) return { ok: false as const, reason: "cooldown", nextAllowedAt: new Date(next).toISOString(), remainingMs: Math.max(0, next - Date.now()) };
		const lastForcedAt = new Date().toISOString();
		if (owned) await connection.query("BEGIN");
		try {
			await enqueueManualClipCrawl(creatorId, connection);
			await connection.query("INSERT INTO \"twitchCache\"(type,key,value,fetched_at,expires_at) VALUES('clip',$1,$2,now(),NULL) ON CONFLICT(type,key) DO UPDATE SET value=excluded.value,fetched_at=excluded.fetched_at,expires_at=NULL", [`clip-sync-force:${creatorId}`, JSON.stringify({ lastForcedAt })]);
			if (owned) await connection.query("COMMIT");
		} catch (error) {
			if (owned) await connection.query("ROLLBACK");
			throw error;
		}
		const wake = () => {
			const pending = withoutDatabaseRequest(() => runClipCrawlerBatch({ creatorId, maxJobs: 1 }).then(() => undefined)).catch((error) => logTwitchError("refreshCreatorClips", error));
			pendingRefreshes.add(pending);
			void pending.finally(() => pendingRefreshes.delete(pending));
		};
		if (context) context.afterCommit(wake);
		else wake();
		return { ok: true as const, accepted: true, lastForcedAt, cooldownMs: clipRefreshCooldownMs, nextAllowedAt: new Date(Date.parse(lastForcedAt) + clipRefreshCooldownMs).toISOString(), remainingMs: clipRefreshCooldownMs };
	} finally {
		if (owned) {
			try {
				await owned.query("select pg_advisory_unlock(hashtext($1))", [key]);
			} catch (error) {
				owned.release(true);
				throw error;
			}
			owned.release();
		}
	}
}
