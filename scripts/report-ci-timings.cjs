/* eslint-disable @typescript-eslint/no-require-imports */
const { appendFileSync } = require("node:fs");
const seconds = (start, end) => Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000) || 0;
function jobTimingRows(jobs) {
	return jobs
		.filter((j) => j.status === "completed" && j.started_at && j.completed_at)
		.map((job) => {
			const totalSeconds = seconds(job.started_at, job.completed_at),
				testSeconds = (job.steps ?? []).filter((s) => /Run owning coverage lane|Run complete browser project shard|Test Runner shard|Run affected tests|Verify execution policy and automation/.test(s.name)).reduce((n, s) => n + seconds(s.started_at, s.completed_at), 0);
			return { name: job.name, waitSeconds: seconds(job.created_at, job.started_at), testSeconds, otherSeconds: Math.max(0, totalSeconds - testSeconds), totalSeconds };
		});
}
module.exports = { jobTimingRows };
async function main() {
	const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: run, GH_TOKEN: token, GITHUB_STEP_SUMMARY: summary } = process.env;
	if (!repo || !run || !token || !summary) throw Error("GitHub run coordinates and a read token are required");
	const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "clipify-ci-timing-report" };
	const jobs = [];
	for (let page = 1; ; page++) {
		const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run}/jobs?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(15000) });
		if (!response.ok) throw Error(`Cannot read CI job timings (${response.status})`);
		const data = await response.json();
		jobs.push(...data.jobs);
		if (data.jobs.length < 100) break;
	}
	const rows = jobTimingRows(jobs).sort((a, b) => b.totalSeconds - a.totalSeconds);
	const lines = [
		"### CI timing breakdown",
		"",
		"Wait is job creation to start and can include dependency/scheduler waiting. Other includes setup, artifacts and cleanup. This final gate is still finishing.",
		"",
		"| Job | Wait (s) | Tests (s) | Setup / other (s) | Job total (s) |",
		"| --- | ---: | ---: | ---: | ---: |",
		...rows.map((r) => `| ${r.name.replaceAll("|", "\\|").replace(/[\r\n]/g, " ")} | ${Math.round(r.waitSeconds)} | ${Math.round(r.testSeconds)} | ${Math.round(r.otherSeconds)} | ${Math.round(r.totalSeconds)} |`),
	];
	appendFileSync(summary, lines.join("\n") + "\n");
}
if (require.main === module)
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
