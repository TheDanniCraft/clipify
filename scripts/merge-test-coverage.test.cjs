/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
test("coverage aggregation rejects missing, repeated and foreign evidence", async () => {
	const { validateLanes } = await import("./merge-test-coverage.mjs");
	const expected = { unit: ["test/a.test.ts"], quiet: ["test/b.test.ts"], workflows: ["bdd/mcp-workflows"] };
	const rows = [
		{ lane: "unit", tree: "tree", tests: expected.unit },
		{ lane: "quiet", tree: "tree", tests: expected.quiet },
		{ lane: "workflows", tree: "tree", tests: ["bdd/mcp-workflows"] },
	];
	assert.doesNotThrow(() => validateLanes(rows, expected, "tree"));
	assert.throws(() => validateLanes(rows.slice(1), expected, "tree"), /Missing/);
	assert.throws(() => validateLanes([...rows, rows[0]], expected, "tree"), /Duplicate/);
	assert.throws(() => validateLanes([{ ...rows[0], tree: "other" }, ...rows.slice(1)], expected, "tree"), /tree/);
	assert.throws(() => validateLanes([{ ...rows[0], tests: [] }, ...rows.slice(1)], expected, "tree"), /inventory/);
});
test("installed Jest thresholds fail incomplete counters and pass their complete union", async () => {
	const { enforceJestCoverage } = await import("./merge-test-coverage.mjs");
	const path = require("node:path").resolve("src/auth/authorize-operation.ts");
	const loc = (line) => ({ start: { line, column: 0 }, end: { line, column: 1 } });
	const report = (a, b) => ({ [path]: { path, statementMap: { 0: loc(1), 1: loc(2) }, fnMap: {}, branchMap: {}, s: { 0: a, 1: b }, f: {}, b: {} } });
	const config = { coverageThreshold: { global: { statements: 100 } }, coverageReporters: [], coverageDirectory: require("node:os").tmpdir(), coverageProvider: "babel" };
	await assert.rejects(enforceJestCoverage([report(1, 0)], config), /Coverage/);
	await assert.doesNotReject(enforceJestCoverage([report(1, 0), report(0, 1)], config));
});
