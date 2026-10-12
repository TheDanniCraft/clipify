export type ClipCrawlScheduleJob = {
	kind: string;
	status: string;
	nextRunAt: string | null;
};

function nextCheck(job: ClipCrawlScheduleJob) {
	if (job.status === "running") return "Checking now";
	if (job.status === "complete") return job.kind === "backfill" ? "Complete" : "Up to date";
	if (job.status === "queued") return "Waiting to start";
	if (!job.nextRunAt) return "Not scheduled";
	const remaining = Date.parse(job.nextRunAt) - Date.now();
	if (!Number.isFinite(remaining)) return "Not scheduled";
	if (remaining <= 0) return "Waiting to start";
	if (remaining < 60_000) return "Next check in less than a minute";
	const minutes = Math.ceil(remaining / 60_000);
	return `Next check in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export default function ClipCrawlSchedule({ jobs }: { jobs?: ClipCrawlScheduleJob[] }) {
	if (!jobs?.length) return null;
	return (
		<div className='grid gap-2 text-xs text-muted md:grid-cols-2'>
			{["recent", "backfill"].map((kind) => {
				const job = jobs.find((job) => job.kind === kind);
				return job ? (
					<p key={kind}>
						<span className='font-semibold'>{kind === "recent" ? "Latest clips:" : "Clip history:"}</span> {nextCheck(job)}
					</p>
				) : null;
			})}
		</div>
	);
}
