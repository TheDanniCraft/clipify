import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionRunnerTests, planRunnerShards } from "./runner-test-sharding.cjs";
import { validateRunnerShardMetadata, nativeCoverageThresholds } from "./merge-runner-coverage.mjs";
const fingerprint = "a".repeat(64);
test("Runner timing plans retain each whole file once without artificial job ceilings", () => {
	const files = ["test/slow.test.ts", "test/other.test.ts", "src/__tests__/fast.test.ts"];
	const weights = { "packages/runner/test/slow.test.ts": 300, "packages/runner/test/other.test.ts": 300, "packages/runner/src/__tests__/fast.test.ts": 1 };
	const shards = planRunnerShards(files, weights);
	assert.equal(shards.length, 3);
	assert.deepEqual(shards.flat().sort(), files.sort());
	assert.deepEqual(
		partitionRunnerTests(files, 2, weights)
			.map((p) => p.length)
			.sort(),
		[1, 2],
	);
});
test("Runner aggregation rejects missing, duplicated, foreign and incomplete shard evidence", () => {
	const expected = [["test/a.test.ts"], ["test/b.test.ts"]];
	const row = (index) => ({ index, count: 2, owners: expected[index - 1], sourceFingerprint: fingerprint, node: process.version, platform: process.platform, arch: process.arch, imageVersion: process.env.ImageVersion ?? null });
	assert.doesNotThrow(() => validateRunnerShardMetadata([row(1), row(2)], expected, fingerprint));
	for (const rows of [[row(1)], [row(1), row(1)], [row(1), { ...row(2), sourceFingerprint: "b".repeat(64) }], [row(1), { ...row(2), owners: ["foreign.test.ts"] }], [row(1), { ...row(2), node: "v0" }]]) assert.throws(() => validateRunnerShardMetadata(rows, expected, fingerprint));
});

test("merged native coverage still rejects a critical file below its existing function floor", async () => {
	const { createRequire } = await import("node:module"),
		{ resolve, join } = await import("node:path"),
		{ mkdtempSync, rmSync } = await import("node:fs"),
		{ tmpdir } = await import("node:os");
	const config = createRequire(import.meta.url)("../packages/runner/jest.config.cjs"),
		{ enforceJestCoverage } = await import("./merge-test-coverage.mjs");
	const directory = mkdtempSync(join(tmpdir(), "runner-merged-floors-"));
	const report = {};
	const loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
	for (const source of config.collectCoverageFrom) {
		const path = resolve("packages/runner", source);
		report[path] = { path, statementMap: { 0: loc }, fnMap: { 0: { name: "covered", decl: loc, loc } }, branchMap: { 0: { loc, type: "if", locations: [loc, loc] } }, s: { 0: 1 }, f: { 0: 1 }, b: { 0: [1, 1] } };
	}
	const nativeConfig = { rootDir: resolve("packages/runner"), coverageThreshold: nativeCoverageThresholds(config.coverageThreshold), coverageDirectory: directory, coverageReporters: ["json"] };
	try {
		await assert.doesNotReject(enforceJestCoverage([report], nativeConfig));
		report[resolve("packages/runner/src/execution-runtime.ts")].f[0] = 0;
		await assert.rejects(enforceJestCoverage([report], nativeConfig), /Coverage/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("native producer matrices belong to Runner while dependency preparation remains singular", async () => {
	const { createRequire } = await import("node:module"),
		{ readFileSync } = await import("node:fs");
	const ci = createRequire(import.meta.url)("yaml").parse(readFileSync(".github/workflows/ci.yml", "utf8"));
	assert.equal(ci.jobs.deps.strategy, undefined);
	assert.equal(ci.jobs.runner.strategy.matrix, "${{ fromJSON(needs.validation-plan.outputs.runner_matrix) }}");
	assert.ok(ci.jobs["runner-coverage"].needs.includes("runner"));
});

test("partial source coverage defers completeness only; the native aggregate remains strict", async () => {
	const { validateRunnerPartialEvidence } = await import("./run-runner-coverage-lane.mjs"),
		{ validateRunnerCoverageEvidence } = await import("../packages/runner/run-coverage.mjs"),
		{ resolve } = await import("node:path");
	const owner = resolve("packages/runner/src/__tests__/execution-clock-binding.test.ts"),
		path = resolve("packages/runner/src/engine.ts"),
		loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
	const results = { success: true, numPassedTests: 1, numTodoTests: 0, numFailedTests: 0, numFailedTestSuites: 0, numPendingTests: 0, numRuntimeErrorTestSuites: 0, testResults: [{ name: owner, status: "passed", assertionResults: [{ fullName: "actual case", status: "passed" }] }] };
	const report = { [path]: { path, statementMap: { 0: loc }, fnMap: {}, branchMap: {}, s: { 0: 1 }, f: {}, b: {} } };
	assert.equal(validateRunnerPartialEvidence(results, report, [owner]).ok, true);
	assert.equal(validateRunnerCoverageEvidence(results, report, [owner]).ok, false);
	assert.equal(validateRunnerPartialEvidence(results, {}, [owner]).ok, false);
	report[path].s[0] = -1;
	assert.equal(validateRunnerPartialEvidence(results, report, [owner]).ok, false);
	report[path].s[0] = 1;
	results.testResults[0].assertionResults[0].status = "pending";
	assert.equal(validateRunnerPartialEvidence(results, report, [owner]).ok, false);
});
