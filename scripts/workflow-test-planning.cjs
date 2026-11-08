/* eslint-disable @typescript-eslint/no-require-imports */
const { browserTestCases, planTestUnits } = require("./browser-sharding.cjs");
const projects = ["bdd-chromium", "atdd-chromium"];
const fixtureKey = (row) => `[${row.test.projectName}] › ${row.file}`;
function workflowUnits(report, profile, workers) {
	const rows = browserTestCases(report, projects),
		counts = new Map(),
		groups = new Map();
	const measured = rows.map((row) => profile[row.selector]).filter((value) => value !== undefined);
	const estimate = measured.length ? measured.reduce((n, v) => n + v, 0) / measured.length : 5;
	for (const row of rows) counts.set(fixtureKey(row), (counts.get(fixtureKey(row)) ?? 0) + 1);
	for (const row of rows) {
		const media = row.tags.includes("@mode:serial"),
			kind = media ? "media" : "protocol",
			grouped = media || row.tags.includes("@shard:fixture");
		const selector = grouped ? fixtureKey(row) : row.selector,
			key = kind + ":" + selector;
		if (!groups.has(key)) groups.set(key, { kind, selector, testIds: [], weight: 0, newTests: 0 });
		const file = row.file.replace(/^\.features-gen\//, "");
		const seconds = profile[row.selector] ?? (profile[file] !== undefined && !rows.some((other) => fixtureKey(other) === fixtureKey(row) && profile[other.selector] !== undefined) ? profile[file] / counts.get(fixtureKey(row)) : estimate);
		const unit = groups.get(key);
		unit.newTests += Number(profile[row.selector] === undefined && profile[file] === undefined);
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
		for (const [i, part] of planTestUnits(selected).entries()) lanes[kind === "media" ? `workflows-media-${i + 1}` : `workflows-${i + 1}`] = { ...part, kind };
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
