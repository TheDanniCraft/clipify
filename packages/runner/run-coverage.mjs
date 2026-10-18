import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { coverageSourceFingerprint } from "../../scripts/coverage-source-fingerprint.mjs";
import { validCoverage } from "../../scripts/coverage-counters.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, "../..");
const config = createRequire(import.meta.url)("./jest.config.cjs");
const normalize = (path) => relative(directory, resolve(directory, path)).replaceAll("\\", "/");

function inheritedUpdaterTodo(suite, test) {
	return normalize(suite.name) === "src/__tests__/updater.test.ts" && test.fullName === "Updater logic should apply an update after a verified hash mismatch" && test.status === "todo";
}
function nativeExecutionComplete(results) {
	return results.success && !results.numFailedTests && !results.numFailedTestSuites && !results.numPendingTests && !results.numRuntimeErrorTestSuites;
}
function countNativeCases(results, errors) {
	let passed = 0;
	let inheritedTodos = 0;
	for (const suite of results.testResults ?? []) {
		if (suite.status !== "passed") errors.push("Nonpassing native owner " + normalize(suite.name));
		if (!suite.assertionResults?.length) errors.push("Empty native owner " + normalize(suite.name));
		for (const test of suite.assertionResults ?? []) {
			const inheritedTodo = inheritedUpdaterTodo(suite, test);
			if (test.status !== "passed" && !inheritedTodo) errors.push("Nonpassing native case " + test.fullName);
			if (test.status === "passed") passed++;
			if (inheritedTodo) inheritedTodos++;
		}
	}
	return { passed, inheritedTodos };
}

export function validateRunnerCoverageEvidence(results, report, owners) {
	const errors = [];
	if (!Array.isArray(owners) || !owners.length || new Set(owners.map(normalize)).size !== owners.length) errors.push("Missing or duplicated expected native inventory");
	const actual = (results.testResults ?? []).map((suite) => normalize(suite.name)).sort();
	if (JSON.stringify(actual) !== JSON.stringify([...owners].map(normalize).sort())) errors.push("Missing, duplicated or foreign native test owner");
	if (!nativeExecutionComplete(results)) errors.push("Incomplete native test execution");
	const { passed, inheritedTodos } = countNativeCases(results, errors);
	if (passed !== results.numPassedTests || inheritedTodos !== results.numTodoTests || inheritedTodos > 1) errors.push("Inconsistent native case totals or expanded inherited TODO allowance");
	const required = [...config.collectCoverageFrom].sort();
	const sources = Object.keys(report).map(normalize).sort();
	if (JSON.stringify(sources) !== JSON.stringify(required)) errors.push("Missing, duplicated or foreign native source coverage");
	for (const [path, value] of Object.entries(report)) if (!validCoverage(value) || normalize(value.path ?? "") !== normalize(path)) errors.push("Invalid native coverage counters " + path);
	return { ok: errors.length === 0, errors, owners: actual, sources };
}

export function runRunnerCoverage() {
	if (process.argv.length > 2) throw new Error("Native completion coverage requires the complete inventory; use the test command for scoped development");
	const output = resolve(directory, "coverage/runner-feature");
	rmSync(output, { recursive: true, force: true });
	mkdirSync(output, { recursive: true });
	const sourceFingerprint = coverageSourceFingerprint(repository);
	const owners = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { cwd: directory, encoding: "utf8" }));
	const resultPath = resolve(output, "jest-results.json");
	const result = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", "--runInBand", "--forceExit", "--coverage", `--coverageDirectory=${output}`, "--json", `--outputFile=${resultPath}`], { cwd: directory, stdio: "inherit", env: process.env });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error("Native coverage execution or configured thresholds failed");
	if (coverageSourceFingerprint(repository) !== sourceFingerprint) throw new Error("Native coverage execution inputs changed during the run");
	const reportPath = resolve(output, "coverage-final.json");
	const results = JSON.parse(readFileSync(resultPath, "utf8"));
	const validation = validateRunnerCoverageEvidence(results, JSON.parse(readFileSync(reportPath, "utf8")), owners);
	if (!validation.ok) throw new Error(validation.errors.join("; "));
	writeFileSync(resolve(output, "execution-inputs.json"), JSON.stringify({ ...validation, sourceFingerprint, node: process.version, reportSha256: createHash("sha256").update(readFileSync(reportPath)).digest("hex"), passed: results.numPassedTests, inheritedTodo: results.numTodoTests }, null, 2) + "\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runRunnerCoverage();
