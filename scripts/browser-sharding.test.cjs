/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectBrowserTests, readTestDurations, planBrowserShards } = require("./test-execution.cjs");
const { collectBrowserDurations } = require("./update-browser-durations.cjs");
const spec = (id, title, duration, split = true) => ({ id, title, file: ".features-gen/bdd/guide.feature.spec.js", tags: split ? ["shard:scenario"] : [], tests: [{ projectName: "bdd-chromium", status: "expected", results: [{ status: "passed", duration }] }] });
const report = (specs) => ({ stats: { unexpected: 0, skipped: 0 }, errors: [], suites: [{ title: ".features-gen/bdd/guide.feature.spec.js", file: ".features-gen/bdd/guide.feature.spec.js", suites: [{ title: "Guide", specs }] }] });
test("weighted scenario shards are exhaustive, disjoint and keep unmarked setup groups together", () => {
	const inventory = report([spec("slow", "Slow journey", 9000), spec("fast", "Fast journey", 1000)]);
	const weights = collectBrowserDurations([inventory]);
	const shards = [0, 1].map((i) => selectBrowserTests(inventory, i, 2, weights));
	assert.deepEqual(shards.flatMap((s) => s.testIds).sort(), ["fast", "slow"]);
	assert.equal(
		shards.every((s) => s.selectors.length === 1),
		true,
	);
	assert.ok(shards[0].selectors[0].includes("Slow journey"));
	const grouped = report([spec("a", "A", 1000, false), spec("b", "B", 1000, false)]);
	const parts = [0, 1].map((i) => selectBrowserTests(grouped, i, 2, {}));
	assert.equal(parts.filter((p) => p.testIds.length === 2).length, 1);
	assert.throws(() => selectBrowserTests(inventory, 2, 2, {}), /shard/);
});
test("timing profiles retain actual durations and reject failed, incomplete or duplicate evidence", () => {
	const r = report([spec("a", "A", 1500), spec("b", "B", 2500)]);
	const d = collectBrowserDurations([r]);
	assert.equal(d["bdd/guide.feature.spec.js"], 4);
	assert.ok(Object.entries(d).some(([k, v]) => k.includes(" › Guide › A") && v === 1.5));
	assert.throws(() => collectBrowserDurations([{ ...r, stats: { unexpected: 1, skipped: 0 } }]), /successful/);
	assert.throws(() => collectBrowserDurations([r, r]), /duplicate/);
	assert.throws(() => collectBrowserDurations([{ ...r, suites: [] }]), /empty/i);
});
test("missing or invalid timing caches fall back without changing the scenario inventory", () => {
	const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
	const { join } = require("node:path");
	const dir = mkdtempSync(join(require("node:os").tmpdir(), "browser-timings-"));
	try {
		const path = join(dir, "timings.json"),
			baseline = readTestDurations();
		assert.deepEqual(readTestDurations(path), baseline);
		for (const content of ["broken", '{"bdd/guide.feature.spec.js":-1}', "[]"]) {
			writeFileSync(path, content);
			assert.deepEqual(readTestDurations(path), baseline);
		}
		writeFileSync(path, JSON.stringify({ "bdd/guide.feature.spec.js": 123 }));
		assert.equal(readTestDurations(path)["bdd/guide.feature.spec.js"], 123);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("automatic plans follow measured work without artificial job ceilings", () => {
	const r = report(Array.from({ length: 30 }, (_, i) => spec(String(i), `Journey ${i}`, 100000)));
	const weights = collectBrowserDurations([r]);
	const plan = planBrowserShards(r, weights, 300);
	assert.equal(plan.length, 10);
	assert.equal(plan.flatMap((s) => s.testIds).length, 30);
	assert.ok(plan.every((s) => s.estimatedSeconds === 300));
	const larger = report(Array.from({ length: 60 }, (_, i) => spec(String(i), `Journey ${i}`, 100000)));
	const scaled = planBrowserShards(larger, collectBrowserDurations([larger]), 300);
	assert.equal(scaled.length, 20);
	assert.equal(scaled.flatMap((s) => s.testIds).length, 60);

	assert.throws(() => collectBrowserDurations([r], ["missing"]), /complete scenario inventory/);
});

test("normal browser estimates exclude failed attempts and retain measured startup", () => {
	const r = report([spec("a", "A", 7000)]);
	r.stats.duration = 78000;
	r.suites[0].suites[0].specs[0].tests[0].status = "flaky";
	r.suites[0].suites[0].specs[0].tests[0].results.unshift({ status: "timedOut", duration: 60000 });
	const durations = collectBrowserDurations([r]);
	assert.equal(durations["bdd/guide.feature.spec.js"], 7);
	assert.equal(durations["__browserStartupSeconds:bdd-chromium"], 11);
	const plan = planBrowserShards(r, durations);
	assert.equal(plan[0].estimatedSeconds, 18);
	r.stats.duration = Infinity;
	assert.throws(() => collectBrowserDurations([r]), /duration/);
	r.stats.duration = 78000;
	r.suites[0].suites[0].specs[0].tests[0].results[0].duration = -1;
	assert.throws(() => collectBrowserDurations([r]), /duration/);
});

test("media prerequisites follow actual selected scenarios and preserve grouped fixtures", () => {
	const r = report([spec("a", "Native", 100000), spec("b", "Frame decode", 100000), spec("c", "UI only", 100000)]);
	r.suites[0].suites[0].specs[0].tags.push("requires:native-media");
	r.suites[0].suites[0].specs[1].tags.push("requires:ffmpeg");
	const parts = [0, 1, 2].map((i) => selectBrowserTests(r, i, 3, collectBrowserDurations([r])));
	assert.equal(parts.filter((p) => p.nativeMedia).length, 1);
	assert.equal(parts.filter((p) => p.ffmpeg).length, 2);
	for (const row of r.suites[0].suites[0].specs) row.tags = row.tags.filter((tag) => tag !== "shard:scenario");
	const grouped = selectBrowserTests(r, 0, 1, collectBrowserDurations([r]));
	assert.equal(grouped.nativeMedia, true);
	assert.equal(grouped.ffmpeg, true);
});

test("all browser projects balance measured work and spread newly discovered scenarios", () => {
	const { planBrowserProjects, BROWSER_PROJECTS } = require("./browser-sharding.cjs");
	const projects = ["acceptance-chromium", "bdd-chromium", "atdd-chromium", "compliance-chromium"];
	assert.deepEqual(BROWSER_PROJECTS, projects);
	const inventory = { suites: projects.map((project) => ({ title: project, specs: Array.from({ length: 12 }, (_, i) => ({ id: `${project}-${i}`, title: `Case ${i}`, file: `test/${project}/case-${i}.spec.ts`, tags: [], tests: [{ projectName: project }] })) })) };
	const weights = Object.fromEntries(projects.flatMap((project) => Array.from({ length: 6 }, (_, i) => [`[${project}] › test/${project}/case-${i}.spec.ts › ${project} › Case ${i}`, 100])));
	const planned = planBrowserProjects(inventory, weights);
	for (const project of projects) {
		const shards = planned[project];
		assert.ok(shards.length >= 4);
		assert.equal(shards.flatMap((s) => s.testIds).length, 12);
		assert.equal(new Set(shards.flatMap((s) => s.testIds)).size, 12);
		assert.ok(shards.every((s) => s.estimatedSeconds <= 300));
		const counts = shards.map((s) => s.testIds.filter((id) => Number(id.split("-").at(-1)) >= 6).length);
		assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
	}
	const slower = Object.fromEntries(Object.keys(weights).map((key) => [key, 200]));
	assert.ok(planBrowserProjects(inventory, slower)["acceptance-chromium"].length > planned["acceptance-chromium"].length);
	const faster = Object.fromEntries(Object.keys(weights).map((key) => [key, 25]));
	assert.ok(planBrowserProjects(inventory, faster)["acceptance-chromium"].length < planned["acceptance-chromium"].length);
});

test("a large new atomic fixture does not force dozens of mostly empty shards", () => {
	const known = Array.from({ length: 10 }, (_, i) => ({ ...spec(`old-${i}`, `Known ${i}`, 100000, false), file: `test/old-${i}.spec.ts` }));
	const fresh = Array.from({ length: 29 }, (_, i) => ({ ...spec(`new-${i}`, `New ${i}`, 10000, false), file: "test/new-fixture.spec.ts" }));
	const r = report([...known, ...fresh]);
	const profile = Object.fromEntries(known.map((row) => [row.file, 100]));
	const bins = planBrowserShards(r, profile, 300);
	assert.ok(bins.length <= 5);
	assert.ok(bins.every((bin) => bin.estimatedSeconds <= 300));
	assert.equal(bins.flatMap((bin) => bin.testIds).length, 39);
});

test("timing feedback covers every project and rejects missing and duplicated execution", () => {
	const { BROWSER_PROJECTS, browserTestCases } = require("./browser-sharding.cjs");
	const reports = BROWSER_PROJECTS.map((project) => {
		const r = report([spec("same-id", "Same test", 1000)]);
		r.suites[0].suites[0].specs[0].tests[0].projectName = project;
		return r;
	});
	const expected = reports.flatMap((r) => browserTestCases(r, BROWSER_PROJECTS).map((row) => row.selector));
	const weights = collectBrowserDurations(reports, expected);
	for (const selector of expected) assert.equal(weights[selector], 1);
	assert.throws(() => collectBrowserDurations(reports.slice(1), expected), /complete scenario inventory/);
	assert.throws(() => collectBrowserDurations([...reports, reports[0]], expected), /duplicate/);
});

test("renamed cases use last-run peer timings and remain new even inside an existing file", () => {
	const { planBrowserProjects, BROWSER_PROJECTS } = require("./browser-sharding.cjs");
	const inventory = { suites: BROWSER_PROJECTS.map((project) => ({ title: "test/renamed.spec.ts", file: "test/renamed.spec.ts", specs: Array.from({ length: 12 }, (_, i) => ({ id: `${project}-${i}`, title: `New ${i}`, file: "test/renamed.spec.ts", tags: ["shard:scenario"], tests: [{ projectName: project }] })) })) };
	const previous = Object.fromEntries(BROWSER_PROJECTS.flatMap((project) => Array.from({ length: 12 }, (_, i) => [`[${project}] › test/renamed.spec.ts › Old ${i}`, 100])));
	for (const project of BROWSER_PROJECTS) previous[`[${project}] › test/renamed.spec.ts`] = 1200;
	const planned = planBrowserProjects(inventory, previous);
	for (const bins of Object.values(planned)) {
		assert.equal(bins.length, 4);
		assert.ok(bins.every((bin) => bin.newTests === 3 && bin.estimatedSeconds === 300));
	}
});
