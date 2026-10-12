import "server-only";
import { syncOwnerClipCache } from "@/app/actions/twitch";
import { dbPool } from "@/db/client";
import { captureUnexpectedError } from "@/app/lib/sentryServer";
import { operationalCount, operationalDuration } from "@/app/lib/operationalHealth";
import { claimClipCrawlJob, completeClipCrawlJob, retryClipCrawlJob, renewClipCrawlLease, type CrawlJob } from "./queue";

function setting(name: string, fallback: number, maximum: number) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? Math.min(maximum, Math.max(1, Math.floor(value))) : fallback;
}
export const clipCrawlBatchSize = setting("CLIP_CRAWL_BATCH_SIZE", 50, 200);
const concurrency = setting("CLIP_CRAWL_CONCURRENCY", 4, 4);
const requestBudget = setting("CLIP_CRAWL_REQUEST_BUDGET", 5, 50);
declare global {
	var __clipCrawlActiveWorkers: number | undefined;
	var __clipCrawlClaimCounter: number | undefined;
}

async function nextCrawlTime(job: CrawlJob, complete: boolean, recentPending: boolean) {
	if (job.kind === "backfill" && complete) return null;
	if (recentPending) return new Date(Date.now() + 60_000);
	const activity = await dbPool.query(
		`SELECT EXISTS(SELECT 1 FROM overlays WHERE owner_id=$1 AND status='active'
 AND greatest(created_at,coalesce(last_used_at,created_at))>now()-interval '1 day') AS active`,
		[job.creator_id],
	);
	const delay = job.kind === "backfill" ? (activity.rows[0].active ? 60_000 : 300_000) : activity.rows[0].active ? 60_000 : 900_000;
	return new Date(Date.now() + delay);
}

async function processJob(job: CrawlJob) {
	const started = Date.now();
	let leaseLost = false;
	let heartbeat = Promise.resolve();
	const timer = setInterval(() => {
		heartbeat = heartbeat
			.then(async () => {
				if (!(await renewClipCrawlLease(job))) leaseLost = true;
			})
			.catch(() => {
				leaseLost = true;
			});
	}, 30_000);
	timer.unref?.();
	try {
		const result = await syncOwnerClipCache(job.creator_id, 0, { kind: job.kind, forceRecent: job.requested_at !== null, requestMarker: job.request_marker ?? undefined, requestBudget });
		await heartbeat;
		if (leaseLost) return;
		if (result?.status === "completed") {
			const next = await nextCrawlTime(job, Boolean(result.backfillComplete), Boolean(result.recentPending));
			if (result.recentPending) await completeClipCrawlJob(job, next, undefined, true);
			else await completeClipCrawlJob(job, next);
			operationalCount("clipify.clip_cache.jobs", 1, { kind: job.kind, status: "completed" });
		} else {
			const delay = result?.status === "busy" ? 5_000 : Math.min(900_000, 30_000 * 2 ** Math.min(job.failures, 5));
			const next = result?.retryAt ? new Date(Math.max(Date.now() + delay, Date.parse(result.retryAt))) : new Date(Date.now() + delay);
			await retryClipCrawlJob(job, result?.status ?? "unavailable", next);
			operationalCount("clipify.clip_cache.jobs", 1, { kind: job.kind, status: result?.status ?? "unavailable" });
		}
	} catch (error) {
		captureUnexpectedError(error, "clip-crawler", "job");
		if (!leaseLost) await retryClipCrawlJob(job, "Crawl failed", new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(job.failures, 5))));
		operationalCount("clipify.clip_cache.jobs", 1, { kind: job.kind, status: "failed" });
	} finally {
		clearInterval(timer);
		await heartbeat;
		operationalDuration("clipify.clip_cache.job.duration", Date.now() - started, { kind: job.kind });
	}
}

/** Claim only when a worker is free, sharing capacity with immediate manual refreshes. */
export async function runClipCrawlerBatch(options: { maxJobs?: number; creatorId?: string } = {}) {
	const maximum = Math.max(1, Math.min(clipCrawlBatchSize, Math.floor(options.maxJobs ?? clipCrawlBatchSize)));
	const deadline = Date.now() + 60_000;
	let claimed = 0;
	const owners = new Set<string>();
	async function worker() {
		if ((globalThis.__clipCrawlActiveWorkers ?? 0) >= concurrency) return;
		globalThis.__clipCrawlActiveWorkers = (globalThis.__clipCrawlActiveWorkers ?? 0) + 1;
		try {
			while (claimed < maximum && Date.now() < deadline) {
				// Reserve the batch slot before awaiting a claim so parallel workers cannot exceed it.
				claimed += 1;
				const sequence = globalThis.__clipCrawlClaimCounter ?? 0;
				globalThis.__clipCrawlClaimCounter = sequence + 1;
				const job = await claimClipCrawlJob({ preferManual: Boolean(options.creatorId) || sequence % 2 === 0, creatorId: options.creatorId });
				if (!job) break;
				owners.add(job.creator_id);
				await processJob(job);
			}
		} finally {
			globalThis.__clipCrawlActiveWorkers = (globalThis.__clipCrawlActiveWorkers ?? 1) - 1;
		}
	}
	const results = await Promise.allSettled(Array.from({ length: concurrency }, () => worker()));
	const failure = results.find((result) => result.status === "rejected");
	if (failure?.status === "rejected") throw failure.reason;
	return owners.size;
}
