/* eslint-disable @typescript-eslint/no-require-imports */
const { browserTestCases, listBrowserTests } = require("./browser-sharding.cjs");
function collectBrowserDurations(reports, expectedIds) {
	const durations = {},
		seen = new Set();
	for (const report of reports) {
		if (report.stats?.unexpected !== 0 || report.stats?.skipped !== 0 || report.errors?.length) throw Error("Timing evidence must come from successful complete browser runs");
		for (const row of browserTestCases(report)) {
			if (seen.has(row.id)) throw Error("Browser timing evidence contains duplicate scenarios");
			seen.add(row.id);
			if (!["expected", "flaky"].includes(row.test.status) || !row.test.results?.length || row.test.results.at(-1).status !== "passed") throw Error("Timing evidence must contain successful scenarios");
			const elapsed = row.test.results.reduce((n, r) => n + r.duration, 0) / 1000;
			if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86400) throw Error("Invalid browser duration");
			const file = row.file.replace(/^\.features-gen\//, "");
			durations[file] = (durations[file] ?? 0) + Math.max(0.001, elapsed);
			if (row.tags.includes("@shard:scenario")) durations[row.selector] = Math.max(0.001, elapsed);
		}
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
		browserTestCases(listBrowserTests()).map((c) => c.id),
	);
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, JSON.stringify(durations, null, 2) + "\n");
	console.log(`Saved current browser timings for ${Object.keys(durations).length} scheduling units; all scenarios executed exactly once.`);
}
