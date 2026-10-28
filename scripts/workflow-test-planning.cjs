/* eslint-disable @typescript-eslint/no-require-imports */
const { browserTestCases, distributeTestUnits } = require("./browser-sharding.cjs");
const projects = ["bdd-chromium", "atdd-chromium"];
const fixtureKey = (row) => `[${row.test.projectName}] › ${row.file}`;
function workflowUnits(report, profile, workers) {
	const rows = browserTestCases(report, projects),
		counts = new Map(),
		groups = new Map();
	for (const row of rows) counts.set(fixtureKey(row), (counts.get(fixtureKey(row)) ?? 0) + 1);
	for (const row of rows) {
		const media = row.tags.includes("@mode:serial"),
			kind = media ? "media" : "protocol",
			grouped = media || row.tags.includes("@shard:fixture");
		const selector = grouped ? fixtureKey(row) : row.selector,
			key = kind + ":" + selector;
		if (!groups.has(key)) groups.set(key, { kind, selector, testIds: [], weight: 0 });
		const file = row.file.replace(/^\.features-gen\//, "");
		const seconds = profile[row.selector] ?? (profile[file] ?? counts.get(fixtureKey(row)) * 5) / counts.get(fixtureKey(row));
		const unit = groups.get(key);
		unit.testIds.push(`${row.id}:${row.test.projectName}`);
		unit.weight += seconds / (media ? 1 : workers);
	}
	return [...groups.values()];
}
function planWorkflowShards(report, profile, workers = 1) {
	if (!Number.isInteger(workers) || workers < 1) throw Error("Invalid native worker estimate");
	const units = workflowUnits(report, profile, workers),
		lanes = {};
	for (const kind of ["protocol", "media"]) {
		const selected = units.filter((u) => u.kind === kind);
		if (!selected.length) continue;
		const count = Math.min(selected.length, Math.max(1, Math.ceil(selected.reduce((n, u) => n + u.weight, 0) / 300)));
		for (const [i, part] of distributeTestUnits(selected, count).entries()) lanes[kind === "media" ? `workflows-media-${i + 1}` : `workflows-${i + 1}`] = { ...part, kind };
	}
	return { lanes };
}
function workflowDurationProfile(reports) {
	const profile = {};
	for (const report of reports)
		for (const row of browserTestCases(report, projects)) {
			const seconds = row.test.results.reduce((n, r) => n + r.duration, 0) / 1000;
			if (!Number.isFinite(seconds) || seconds < 0) throw Error("Invalid native workflow timing");
			profile[row.selector] = Math.max(0.001, seconds);
		}
	return profile;
}
module.exports = { planWorkflowShards, workflowDurationProfile };
