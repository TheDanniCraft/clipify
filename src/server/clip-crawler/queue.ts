import "server-only";
import { randomUUID } from "node:crypto";
import { dbPool } from "@/db/client";

export type CrawlKind = "recent" | "backfill";
export type CrawlJob = {
	creator_id: string;
	kind: CrawlKind;
	requested_at: Date | null;
	request_marker: string | null;
	lease_id: string;
	failures: number;
};
type Connection = { query: (statement: string, parameters?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };
export const CRAWL_LEASE_MS = 120_000;

/** Backfill the queue incrementally; selection excludes already seeded creators. */
export async function seedClipCrawlJobs(connection: Connection = dbPool, limit = 1000) {
	const result = await connection.query(
		`
		WITH creators AS (
			SELECT DISTINCT o.owner_id FROM overlays o JOIN users u ON u.id=o.owner_id
			WHERE o.status='active' AND NOT u.disabled AND NOT EXISTS (
				SELECT 1 FROM clip_crawl_jobs j WHERE j.creator_id=o.owner_id AND j.kind='recent'
			) ORDER BY o.owner_id LIMIT $1
		)
		INSERT INTO clip_crawl_jobs(creator_id,kind,next_run_at)
		SELECT owner_id,kind,now() FROM creators CROSS JOIN (VALUES ('recent'),('backfill')) kinds(kind)
		ON CONFLICT (creator_id,kind) DO NOTHING`,
		[Math.max(1, Math.min(10_000, Math.floor(limit)))],
	);
	return result.rowCount ?? 0;
}

/** Call within the same transaction that accepts the manual-refresh cooldown. */
export async function enqueueManualClipCrawl(creatorId: string, connection: Connection = dbPool) {
	await connection.query(
		`
		INSERT INTO clip_crawl_jobs(creator_id,kind,next_run_at,requested_at)
		VALUES ($1,'recent',now(),now()),($1,'backfill',now(),NULL)
		ON CONFLICT (creator_id,kind) DO UPDATE SET
			next_run_at=CASE WHEN excluded.kind='recent' THEN now() ELSE clip_crawl_jobs.next_run_at END,
			requested_at=CASE WHEN excluded.kind='recent' THEN now() ELSE clip_crawl_jobs.requested_at END`,
		[creatorId],
	);
}

/** Atomic row-lock claim; alternate priority slots with ordinary oldest-due slots. */
export async function claimClipCrawlJob(options: { preferManual: boolean; creatorId?: string }, connection: Connection = dbPool): Promise<CrawlJob | null> {
	const result = await connection.query(
		`
		WITH priority AS (
 SELECT j.creator_id,j.kind FROM clip_crawl_jobs j JOIN users u ON u.id=j.creator_id
 WHERE $1 AND j.requested_at IS NOT NULL AND j.next_run_at<=now() AND NOT u.disabled
 AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=now())
 AND ($2::varchar IS NULL OR j.creator_id=$2)
 ORDER BY j.next_run_at,j.creator_id,j.kind
 FOR UPDATE OF j SKIP LOCKED LIMIT 1
 ), ordinary AS (
 SELECT j.creator_id,j.kind FROM clip_crawl_jobs j JOIN users u ON u.id=j.creator_id
 WHERE NOT EXISTS(SELECT 1 FROM priority) AND j.next_run_at<=now() AND NOT u.disabled
 AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=now())
 AND ($2::varchar IS NULL OR j.creator_id=$2)
 ORDER BY j.next_run_at,j.creator_id,j.kind
 FOR UPDATE OF j SKIP LOCKED LIMIT 1
 ), candidate AS (SELECT * FROM priority UNION ALL SELECT * FROM ordinary)

		UPDATE clip_crawl_jobs j SET lease_id=$3::uuid,
			lease_expires_at=now()+($4::integer * interval '1 millisecond'),attempts=j.attempts+1
		FROM candidate c WHERE j.creator_id=c.creator_id AND j.kind=c.kind RETURNING j.*, j.requested_at::text AS request_marker`,
		[options.preferManual, options.creatorId ?? null, randomUUID(), CRAWL_LEASE_MS],
	);
	return (result.rows[0] as CrawlJob | undefined) ?? null;
}

export async function renewClipCrawlLease(job: CrawlJob, connection: Connection = dbPool) {
	const result = await connection.query(
		`UPDATE clip_crawl_jobs
		SET lease_expires_at=now()+($4::integer * interval '1 millisecond')
		WHERE creator_id=$1 AND kind=$2 AND lease_id=$3::uuid AND lease_expires_at>now()`,
		[job.creator_id, job.kind, job.lease_id, CRAWL_LEASE_MS],
	);
	return result.rowCount === 1;
}

/** Lease fencing also preserves a newer refresh request made during this job. */
export async function completeClipCrawlJob(job: CrawlJob, nextRunAt: Date | null, connection: Connection = dbPool, keepRequest = false) {
	const result = await connection.query(
		`UPDATE clip_crawl_jobs SET
		next_run_at=CASE WHEN requested_at IS NOT NULL AND requested_at IS DISTINCT FROM $4::timestamptz THEN now() ELSE $5::timestamptz END,
		requested_at=CASE WHEN requested_at IS NOT NULL AND requested_at IS DISTINCT FROM $4::timestamptz THEN requested_at WHEN $6::boolean THEN requested_at ELSE NULL END,
		lease_id=NULL,lease_expires_at=NULL,failures=0,last_error=NULL,last_completed_at=now()
		WHERE creator_id=$1 AND kind=$2 AND lease_id=$3::uuid AND lease_expires_at>now()`,
		[job.creator_id, job.kind, job.lease_id, job.request_marker, nextRunAt, keepRequest],
	);
	return result.rowCount === 1;
}

export async function retryClipCrawlJob(job: CrawlJob, error: string, nextRunAt: Date, connection: Connection = dbPool) {
	const result = await connection.query(
		`UPDATE clip_crawl_jobs SET
		next_run_at=$4::timestamptz,failures=failures+1,last_error=$5,lease_id=NULL,lease_expires_at=NULL
		WHERE creator_id=$1 AND kind=$2 AND lease_id=$3::uuid AND lease_expires_at>now()`,
		[job.creator_id, job.kind, job.lease_id, nextRunAt, error.slice(0, 500)],
	);
	return result.rowCount === 1;
}
