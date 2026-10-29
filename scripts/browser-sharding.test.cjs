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
	const plan = planBrowserShards(r, weights, 300, 10);
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
	assert.equal(durations.__browserStartupSeconds, 11);
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
