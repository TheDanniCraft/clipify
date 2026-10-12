import { createMcpPostgresFixture } from "./postgres";
import { randomUUID } from "node:crypto";
import { Plan, Role, OverlayType } from "@/app/lib/types";

async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	try {
		const queue = await import("@/server/clip-crawler/queue");
		const pool = fixture.pool;
		const mode = process.argv[2];
		async function creator(id: string) {
			await pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,$1,'',$3,$4)", [id, `${id}@example.invalid`, Role.User, Plan.Free]);
			await pool.query("INSERT INTO overlays(id,owner_id,name,status,type) VALUES($1,$2,'Fixture','active',$3)", [randomUUID(), id, OverlayType.All]);
		}
		await creator("creator-a");
		await creator("creator-b");
		await queue.seedClipCrawlJobs(pool);
		const claim = (preferManual = false) => queue.claimClipCrawlJob({ preferManual }, pool);
		let output: unknown;
		if (mode === "concurrent") {
			const jobs = (await Promise.all(Array.from({ length: 12 }, () => claim()))).filter(Boolean);
			output = { count: jobs.length, identities: jobs.map((job) => `${job!.creator_id}:${job!.kind}`) };
		}
		if (mode === "recovery") {
			const old = (await claim())!;
			await pool.query("UPDATE clip_crawl_jobs SET lease_expires_at=now()-interval '1 second' WHERE creator_id=$1 AND kind=$2", [old.creator_id, old.kind]);
			const recovered = (await claim())!;
			output = { sameJob: old.creator_id === recovered.creator_id && old.kind === recovered.kind, differentLease: old.lease_id !== recovered.lease_id, staleComplete: await queue.completeClipCrawlJob(old, null, pool), staleRetry: await queue.retryClipCrawlJob(old, "old", new Date(), pool), staleRenew: await queue.renewClipCrawlLease(old, pool), completed: await queue.completeClipCrawlJob(recovered, null, pool) };
		}
		if (mode === "request-continuation") {
			await queue.enqueueManualClipCrawl("creator-b", pool);
			const job = (await claim(true))!;
			await queue.completeClipCrawlJob(job, new Date(Date.now() + 60000), pool, true);
			output = (await pool.query("SELECT requested_at IS NOT NULL AS requested,next_run_at>now() AS rescheduled FROM clip_crawl_jobs WHERE creator_id='creator-b' AND kind='recent'")).rows[0];
		}
		if (mode === "request-completed") {
			await queue.enqueueManualClipCrawl("creator-b", pool);
			const job = (await claim(true))!;
			await queue.completeClipCrawlJob(job, new Date(Date.now() + 600000), pool);
			output = (await pool.query("SELECT requested_at IS NULL AS cleared,next_run_at>now() AS rescheduled FROM clip_crawl_jobs WHERE creator_id='creator-b' AND kind='recent'")).rows[0];
		}
		if (mode === "request-during-run") {
			await queue.enqueueManualClipCrawl("creator-b", pool);
			const job = (await claim(true))!;
			await queue.enqueueManualClipCrawl("creator-b", pool);
			await queue.completeClipCrawlJob(job, new Date(Date.now() + 600000), pool);
			const row = (await pool.query("SELECT requested_at IS NOT NULL AS requested,next_run_at<=now() AS due FROM clip_crawl_jobs WHERE creator_id='creator-b' AND kind='recent'")).rows[0];
			output = { creatorId: job.creator_id, ...row };
		}
		if (mode === "priority-fairness") {
			await pool.query("UPDATE clip_crawl_jobs SET next_run_at=now()-interval '1 day'");
			await queue.enqueueManualClipCrawl("creator-b", pool);
			const priority = (await claim(true))!;
			const ordinary = (await claim(false))!;
			output = { priority: priority.creator_id, priorityKind: priority.kind, ordinary: ordinary.creator_id };
		}
		if (mode === "coalesce") {
			await Promise.all(Array.from({ length: 12 }, () => queue.enqueueManualClipCrawl("creator-a", pool)));
			output = { count: (await pool.query("SELECT count(*)::int AS count FROM clip_crawl_jobs WHERE creator_id='creator-a'")).rows[0].count };
		}
		if (mode === "seed-rotation") {
			for (let i = 0; i < 80; i++) await creator(`creator-${i}`);
			await queue.seedClipCrawlJobs(pool, 50);
			await queue.seedClipCrawlJobs(pool, 50);
			output = { count: (await pool.query("SELECT count(DISTINCT creator_id)::int AS count FROM clip_crawl_jobs")).rows[0].count };
		}
		if (mode === "indexed-claims") {
			await pool.query("INSERT INTO users(id,email,username,avatar,role,plan) SELECT 'load-'||n,'load-'||n||'@example.invalid','load-'||n,'','user','free' FROM generate_series(1,100000) n");
			await pool.query("INSERT INTO clip_crawl_jobs(creator_id,kind,next_run_at,requested_at) SELECT id,kind,now()-interval '1 day',CASE WHEN id='load-99999' AND kind='recent' THEN now() END FROM users CROSS JOIN (VALUES('recent'),('backfill')) kinds(kind) ON CONFLICT DO NOTHING");
			await pool.query("ANALYZE users");
			await pool.query("ANALYZE clip_crawl_jobs");
			const plans: unknown[] = [];
			const explained = {
				query: async (statement: string, values?: unknown[]) => {
					const plan = (await pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) " + statement, values)).rows[0]["QUERY PLAN"][0];
					plans.push(plan);
					return { rows: [], rowCount: 0 };
				},
			};
			await queue.claimClipCrawlJob({ preferManual: false }, explained);
			await queue.claimClipCrawlJob({ preferManual: true }, explained);
			const text = JSON.stringify(plans);
			output = { indexedDue: text.includes("clip_crawl_jobs_due_idx"), indexedPriority: text.includes("clip_crawl_jobs_manual_idx"), plans: process.env.CLIP_CRAWL_EXPLAIN === "1" ? plans : undefined, executionMs: plans.map((plan) => (plan as Record<string, number>)["Execution Time"]) };
		}
		if (mode === "disabled") {
			await pool.query("UPDATE users SET disabled=true");
			output = { job: await claim() };
		}
		if (mode === "rollback") {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				await queue.enqueueManualClipCrawl("creator-a", client);
				await client.query("ROLLBACK");
			} finally {
				client.release();
			}
			output = { requested: (await pool.query("SELECT requested_at FROM clip_crawl_jobs WHERE creator_id='creator-a' AND kind='recent'")).rows[0].requested_at };
		}
		console.log(JSON.stringify(output));
	} finally {
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
