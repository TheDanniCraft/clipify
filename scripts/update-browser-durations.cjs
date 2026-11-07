/* eslint-disable @typescript-eslint/no-require-imports */
const { browserTestCases, listBrowserTests, BROWSER_PROJECTS } = require("./browser-sharding.cjs");
function collectBrowserDurations(reports, expectedIds) {
	const durations = {},
		seen = new Set(),
		startup = [];
	for (const report of reports) {
		if (report.stats?.unexpected !== 0 || report.stats?.skipped !== 0 || report.errors?.length) throw Error("Timing evidence must come from successful complete browser runs");
		let attemptsSeconds = 0;
		for (const row of browserTestCases(report, BROWSER_PROJECTS)) {
			if (seen.has(row.selector)) throw Error("Browser timing evidence contains duplicate scenarios");
			seen.add(row.selector);
			if (!["expected", "flaky"].includes(row.test.status) || !row.test.results?.length || row.test.results.at(-1).status !== "passed") throw Error("Timing evidence must contain successful scenarios");
			for (const attempt of row.test.results) if (!Number.isFinite(attempt.duration) || attempt.duration < 0) throw Error("Invalid browser duration");
			attemptsSeconds += row.test.results.reduce((n, r) => n + r.duration, 0) / 1000;
			const elapsed = row.test.results.at(-1).duration / 1000;
			if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86400) throw Error("Invalid browser duration");
			const file = row.file.replace(/^\.features-gen\//, "");
			durations[file] = (durations[file] ?? 0) + Math.max(0.001, elapsed);
			const qualifiedFile = `[${row.test.projectName}] › ${row.file}`;
			durations[qualifiedFile] = (durations[qualifiedFile] ?? 0) + Math.max(0.001, elapsed);
			durations[row.selector] = Math.max(0.001, elapsed);
		}
		if (report.stats.duration !== undefined) {
			if (!Number.isFinite(report.stats.duration) || report.stats.duration < 0) throw Error("Invalid browser duration");
			const project = browserTestCases(report, BROWSER_PROJECTS)[0].test.projectName;
			startup.push({ project, seconds: Math.max(0, report.stats.duration / 1000 - attemptsSeconds) });
		}
	}
	for (const project of BROWSER_PROJECTS) {
		const samples = startup.filter((s) => s.project === project);
		const seconds = samples.reduce((n, s) => n + s.seconds, 0) / samples.length;
		if (seconds > 0) durations[`__browserStartupSeconds:${project}`] = seconds;
	}

	if (!seen.size) throw Error("Browser timing inventory is empty");
	if (expectedIds && JSON.stringify([...seen].sort()) !== JSON.stringify([...expectedIds].sort())) throw Error("Browser shards did not execute their complete scenario inventory");
	return durations;
}
module.exports = { collectBrowserDurations };
if (require.main === module) {
	const { readdirSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs"),
		{ join, dirname } = require("node:path");
	const [directory, output] = process.argv.slice(2);
	const reports = readdirSync(directory, { recursive: true })
		.filter((p) => p.endsWith(".json"))
		.map((p) => JSON.parse(readFileSync(join(directory, p), "utf8")));
	const durations = collectBrowserDurations(
		reports,
		browserTestCases(listBrowserTests([], BROWSER_PROJECTS), BROWSER_PROJECTS).map((c) => c.selector),
	);
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, JSON.stringify(durations, null, 2) + "\n");
	console.log(`Saved successful-attempt browser timings (retry delays remain in execution reports) for ${Object.keys(durations).length} timing entries; all scenarios executed exactly once.`);
}
