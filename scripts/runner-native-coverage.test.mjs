import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { validateRunnerCoverageEvidence } from "../packages/runner/run-coverage.mjs";

const config = createRequire(import.meta.url)("../packages/runner/jest.config.cjs");
const owner = resolve("packages/runner/src/__tests__/execution-runtime.test.ts");
function fixture() {
	const results = { success: true, numPassedTests: 1, numTodoTests: 0, numFailedTests: 0, numFailedTestSuites: 0, numPendingTests: 0, numRuntimeErrorTestSuites: 0, testResults: [{ name: owner, status: "passed", assertionResults: [{ fullName: "native case", status: "passed" }] }] };
	const report = {};
	for (const source of config.collectCoverageFrom) {
		const path = resolve("packages/runner", source);
		const loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
		report[path] = { path, statementMap: { 0: loc }, fnMap: {}, branchMap: {}, s: { 0: 1 }, f: {}, b: {} };
	}
	return { results, report, owners: [owner] };
}
const evaluate = ({ results, report, owners }) => validateRunnerCoverageEvidence(results, report, owners);
test("native evidence accepts the complete owned source and case inventory", () => assert.equal(evaluate(fixture()).ok, true));
test("native evidence refuses an empty inventory", () => {
	const input = fixture();
	input.owners = [];
	input.results.testResults = [];
	input.results.numPassedTests = 0;
	assert.equal(evaluate(input).ok, false);
});
test("native evidence refuses inconsistent case totals", () => {
	const inconsistent = fixture();
	inconsistent.results.numPassedTests = 2;
	assert.equal(evaluate(inconsistent).ok, false);
});
test("native evidence rejects missing, foreign and malformed source counters", () => {
	for (const mode of ["missing", "foreign", "malformed", "mismatched-path"]) {
		const input = fixture();
		const first = Object.keys(input.report)[0];
		if (mode === "missing") delete input.report[first];
		if (mode === "foreign") input.report[resolve("packages/runner/src/foreign.ts")] = input.report[first];
		if (mode === "malformed") input.report[first].s[0] = -1;
		if (mode === "mismatched-path") input.report[first].path = resolve("packages/runner/src/foreign.ts");
		assert.equal(evaluate(input).ok, false, mode);
	}
});
test("native evidence rejects missing owners, duplicate owners and skipped assertions", () => {
	for (const mode of ["missing", "duplicate", "skipped"]) {
		const input = fixture();
		if (mode === "missing") input.results.testResults = [];
		if (mode === "duplicate") input.results.testResults.push(input.results.testResults[0]);
		if (mode === "skipped") input.results.testResults[0].assertionResults[0].status = "pending";
		assert.equal(evaluate(input).ok, false, mode);
	}
});
test("native evidence retains only the exact inherited updater TODO", () => {
	const input = fixture();
	const name = resolve("packages/runner/src/__tests__/updater.test.ts");
	input.owners.push(name);
	input.results.testResults.push({ name, status: "passed", assertionResults: [{ fullName: "Updater logic should apply an update after a verified hash mismatch", status: "todo" }] });
	input.results.numTodoTests = 1;
	assert.equal(evaluate(input).ok, true);
	input.results.testResults[1].assertionResults[0].fullName = "new unimplemented behavior";
	assert.equal(evaluate(input).ok, false);
});
