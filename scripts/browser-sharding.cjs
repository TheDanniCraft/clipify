/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync, existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const baseline = require("./test-duration-baseline.json");

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
function listBrowserTests(args = []) {
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	return JSON.parse(execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--project=bdd-chromium", ...args, "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
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
	if (!cases.length || new Set(cases.map((c) => c.id)).size !== cases.length || cases.some((c) => !c.id)) throw Error("Empty or duplicate browser scenario inventory");
	return cases;
}
function browserTestUnits(report, profile = readTestDurations()) {
	const groups = new Map();
	for (const row of browserTestCases(report)) {
		if (!groups.has(row.file)) groups.set(row.file, []);
		groups.get(row.file).push(row);
	}
	const unit = (rows, selector, weight) => {
		const nativeMedia = rows.some((c) => c.tags.includes("@requires:native-media"));
		return { selector, testIds: rows.map((c) => c.id), weight, nativeMedia, ffmpeg: nativeMedia || rows.some((c) => c.tags.includes("@requires:ffmpeg")) };
	};
	return [...groups].flatMap(([file, cases]) => {
		const fallback = profile[file.replace(/^\.features-gen\//, "")] ?? cases.length;
		// Only explicitly independent fixtures may split a file across workers.
		const split = cases.every((c) => c.tags.includes("@shard:scenario") && !c.tags.includes("@mode:serial"));
		return split ? cases.map((c) => unit([c], c.selector, profile[c.selector] ?? fallback / cases.length)) : [unit(cases, file, fallback)];
	});
}
function distributeTestUnits(units, count, startupSeconds = 0) {
	if (!Number.isInteger(count) || count < 1) throw Error("Invalid browser shard count");
	const bins = Array.from({ length: count }, () => ({ selectors: [], testIds: [], estimatedSeconds: startupSeconds, nativeMedia: false, ffmpeg: false }));
	for (const unit of [...units].sort((a, b) => b.weight - a.weight || a.selector.localeCompare(b.selector))) {
		const bin = bins.reduce((best, candidate) => (candidate.estimatedSeconds < best.estimatedSeconds ? candidate : best));
		bin.selectors.push(unit.selector);
		bin.testIds.push(...unit.testIds);
		bin.estimatedSeconds += unit.weight;
		bin.nativeMedia ||= Boolean(unit.nativeMedia);
		bin.ffmpeg ||= Boolean(unit.ffmpeg);
	}
	return bins;
}
function selectBrowserTests(report, index, count, profile = readTestDurations()) {
	if (!Number.isInteger(index) || index < 0 || index >= count) throw Error("Invalid browser shard");
	return distributeTestUnits(browserTestUnits(report, profile), count, profile.__browserStartupSeconds ?? 0)[index];
}
function planBrowserShards(report, profile = readTestDurations(), targetSeconds = 300) {
	if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) throw Error("Invalid browser shard budget");
	const units = browserTestUnits(report, profile),
		total = units.reduce((n, u) => n + u.weight, 0);
	const startupSeconds = profile.__browserStartupSeconds ?? 0;
	const count = Math.min(units.length, Math.max(1, Math.ceil(total / Math.max(1, targetSeconds - startupSeconds))));
	return distributeTestUnits(units, count, startupSeconds);
}
module.exports = { readTestDurations, listBrowserTests, browserTestCases, selectBrowserTests, planBrowserShards, distributeTestUnits };
