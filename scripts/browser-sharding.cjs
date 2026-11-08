/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync, existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const baseline = require("./test-duration-baseline.json");
const BROWSER_PROJECTS = ["acceptance-chromium", "bdd-chromium", "atdd-chromium", "compliance-chromium"];

function readTestDurations(path = process.env.CLIPIFY_TEST_DURATION_FILE) {
	if (!path || !existsSync(path)) return baseline;
	try {
		const cached = JSON.parse(readFileSync(path, "utf8"));
		if (!cached || Array.isArray(cached) || typeof cached !== "object" || Object.values(cached).some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 86400)) throw Error("Invalid timing values");
		return { ...baseline, ...cached };
	} catch {
		console.warn("Ignoring invalid optional browser timing cache; using the checked-in baseline.");
		return baseline;
	}
}
function listBrowserTests(args = [], projects = ["bdd-chromium"]) {
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	return JSON.parse(execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...projects.map((project) => `--project=${project}`), ...args, "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
}
function browserTestCases(report, projects = ["bdd-chromium"]) {
	const cases = [];
	const visit = (suite, parents = []) => {
		const titles = suite.title === suite.file ? parents : [...parents, suite.title];
		for (const spec of suite.specs ?? [])
			for (const test of spec.tests ?? []) {
				if (!projects.includes(test.projectName)) continue;
				const file = spec.file.replaceAll("\\", "/");
				const selector = `[${test.projectName}] › ${file} › ${[...titles, spec.title].join(" › ")}`;
				cases.push({ id: spec.id, file, selector, tags: (spec.tags ?? []).map((tag) => (tag.startsWith("@") ? tag : `@${tag}`)), test });
			}
		for (const child of suite.suites ?? []) visit(child, titles);
	};
	for (const suite of report.suites ?? []) visit(suite);
	if (!cases.length || new Set(cases.map((c) => `${c.test.projectName}:${c.id}`)).size !== cases.length || cases.some((c) => !c.id)) throw Error("Empty or duplicate browser scenario inventory");
	return cases;
}
function browserTestUnits(report, profile = readTestDurations(), projects = ["bdd-chromium"]) {
	const rows = browserTestCases(report, projects),
		groups = new Map();
	const current = rows.filter((row) => profile[row.selector] !== undefined).map((row) => profile[row.selector]);
	const historical = Object.entries(profile)
		.filter(([key]) => projects.some((project) => key.startsWith(`[${project}] › `)) && key.split(" › ").length > 2)
		.map(([, seconds]) => seconds);
	const measured = current.length ? current : historical;
	const estimate = measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : 10;
	for (const row of rows) {
		const key = `[${row.test.projectName}] › ${row.file}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(row);
	}
	const unit = (cases, selector, weight, newTests) => {
		const nativeMedia = cases.some((c) => c.tags.includes("@requires:native-media"));
		return { selector, testIds: cases.map((c) => c.id), weight, newTests, nativeMedia, ffmpeg: nativeMedia || cases.some((c) => c.tags.includes("@requires:ffmpeg")) };
	};
	return [...groups].flatMap(([file, cases]) => {
		const legacy = profile[file] ?? profile[cases[0].file.replace(/^\.features-gen\//, "")];
		const hasHistory = Object.keys(profile).some((key) => key.startsWith(file + " › "));
		const weight = (c) => profile[c.selector] ?? (!hasHistory && legacy !== undefined ? legacy / cases.length : estimate);
		const isNew = (c) => profile[c.selector] === undefined && (hasHistory || legacy === undefined);
		const split = cases.every((c) => c.tags.includes("@shard:scenario") && !c.tags.includes("@mode:serial"));
		return split
			? cases.map((c) => unit([c], c.selector, weight(c), Number(isNew(c))))
			: [
					unit(
						cases,
						file,
						cases.reduce((n, c) => n + weight(c), 0),
						cases.filter(isNew).length,
					),
				];
	});
}
function distributeTestUnits(units, count, startupSeconds = 0, budget = Infinity) {
	if (!Number.isInteger(count) || count < 1) throw Error("Invalid browser shard count");
	const bins = Array.from({ length: count }, () => ({ selectors: [], testIds: [], estimatedSeconds: startupSeconds, nativeMedia: false, ffmpeg: false, newTests: 0 }));
	for (const unit of [...units].sort((a, b) => b.weight - a.weight || a.selector.localeCompare(b.selector))) {
		const fits = bins.filter((bin) => bin.estimatedSeconds + unit.weight <= budget);
		const bin = (fits.length ? fits : bins).reduce((best, candidate) => (unit.newTests && candidate.newTests !== best.newTests ? (candidate.newTests < best.newTests ? candidate : best) : candidate.estimatedSeconds < best.estimatedSeconds ? candidate : best));
		bin.selectors.push(unit.selector);
		bin.testIds.push(...unit.testIds);
		bin.estimatedSeconds += unit.weight;
		bin.newTests += unit.newTests ?? 0;
		bin.nativeMedia ||= Boolean(unit.nativeMedia);
		bin.ffmpeg ||= Boolean(unit.ffmpeg);
	}
	return bins;
}
function selectBrowserTests(report, index, count, profile = readTestDurations(), projects = ["bdd-chromium"]) {
	if (!Number.isInteger(index) || index < 0 || index >= count) throw Error("Invalid browser shard");
	return distributeTestUnits(browserTestUnits(report, profile, projects), count, profile[`__browserStartupSeconds:${projects[0]}`] ?? profile.__browserStartupSeconds ?? 0)[index];
}
function planTestUnits(units, targetSeconds = 300, startupSeconds = 0) {
	if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) throw Error("Invalid shard budget");
	if (!units.length) return [];
	const total = units.reduce((n, u) => n + u.weight, 0);
	const count = Math.min(units.length, Math.max(1, Math.ceil(total / Math.max(1, targetSeconds - startupSeconds))));
	const attainable = Math.max(targetSeconds, startupSeconds + Math.max(...units.map((unit) => unit.weight)));
	let bins = distributeTestUnits(units, count, startupSeconds, attainable);
	while (bins.some((bin) => bin.estimatedSeconds > attainable) && bins.length < units.length) bins = distributeTestUnits(units, bins.length + 1, startupSeconds, attainable);
	return bins.filter((bin) => bin.testIds.length);
}
function planBrowserShards(report, profile = readTestDurations(), targetSeconds = 300, projects = ["bdd-chromium"]) {
	return planTestUnits(browserTestUnits(report, profile, projects), targetSeconds, profile[`__browserStartupSeconds:${projects[0]}`] ?? profile.__browserStartupSeconds ?? 0);
}
function planBrowserProjects(report, profile = readTestDurations(), targetSeconds = 300) {
	return Object.fromEntries(BROWSER_PROJECTS.map((project) => [project, planBrowserShards(report, profile, targetSeconds, [project])]));
}
module.exports = { planTestUnits, BROWSER_PROJECTS, planBrowserProjects, readTestDurations, listBrowserTests, browserTestCases, selectBrowserTests, planBrowserShards, distributeTestUnits };
