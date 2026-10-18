import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { enforceJestCoverage } from "./merge-test-coverage.mjs";

const path = resolve("src/app/components/overlayPlayer.tsx");
const source = [...Array(100).fill("existing();"), "const runnerPresentationA = 1;", "const runnerPresentationB = 2;"].join("\n");
const config = { coverageThreshold: { global: { statements: 0, functions: 0, branches: 0, lines: 0 } }, coverageReporters: [], coverageDirectory: tmpdir(), coverageProvider: "babel" };
const options = { runnerPlayer: true, runnerSource: source };
function report() {
	const file = { path, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} };
	for (let id = 0; id < 102; id++) {
		const loc = { start: { line: id + 1, column: 0 }, end: { line: id + 1, column: 1 } };
		file.statementMap[id] = loc;
		file.fnMap[id] = { name: `fn${id}`, decl: loc, loc };
		file.branchMap[id] = { type: "if", line: id + 1, loc, locations: [loc] };
		file.s[id] = file.f[id] = 1;
		file.b[id] = [1];
	}
	return { [path]: file };
}
test("Runner player gate accepts complete retained and changed counters", async () => {
	await assert.doesNotReject(enforceJestCoverage([report()], config, options));
});
for (const metric of ["statements", "functions", "branches"]) {
	test(`Runner ${metric} cannot hide behind the much larger retained player`, async () => {
		const input = report();
		if (metric === "statements") input[path].s[101] = 0;
		if (metric === "functions") input[path].f[101] = 0;
		if (metric === "branches") input[path].b[101] = [0];
		await assert.rejects(enforceJestCoverage([input], config, options), (error) => error.message.includes(`Runner ${metric}`) && (metric !== "statements" || error.message.includes("Runner lines")));
	});
}
test("Runner player source is required even when global coverage would pass", async () => {
	await assert.rejects(enforceJestCoverage([{}], config, options), /Missing required legacy player/);
});
test("retained player floors cannot regress while every new Runner counter passes", async () => {
	const input = report();
	for (let id = 0; id < 100; id++) input[path].f[id] = 0;
	await assert.rejects(enforceJestCoverage([input], config, options), /Retained player functions/);
});
