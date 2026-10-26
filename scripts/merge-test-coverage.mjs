import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import execution from "./test-execution.cjs";
import { evaluateMcpCoverage } from "./check-mcp-coverage.mjs";
import { coverageSourceFingerprint } from "./coverage-source-fingerprint.mjs";
import { evaluateRunnerPlayerCoverage } from "./check-runner-player-coverage.mjs";
import coverageLibrary from "istanbul-lib-coverage";
const require = createRequire(import.meta.url);

export function validateLanes(rows, expected, tree, sourceFingerprint) {
	if (!/^[a-f0-9]{64}$/.test(sourceFingerprint ?? "")) throw new Error("Missing current coverage source fingerprint");
	const lanes = expected;
	const seen = new Set();
	for (const row of rows) {
		if (seen.has(row.lane)) throw new Error(`Duplicate lane ${row.lane}`);
		seen.add(row.lane);
		if (row.tree !== tree) throw new Error("Coverage evidence belongs to another source tree");
		if (row.sourceFingerprint !== sourceFingerprint) throw new Error("Coverage evidence has a missing or foreign source fingerprint");
		if (!lanes[row.lane] || JSON.stringify([...row.tests].sort()) !== JSON.stringify([...lanes[row.lane]].sort())) throw new Error(`Incorrect inventory for ${row.lane}`);
	}
	for (const lane of Object.keys(lanes)) if (!seen.has(lane)) throw new Error(`Missing lane ${lane}`);
}

export async function enforceJestCoverage(reports, config, options = {}) {
	const { CoverageReporter } = require("@jest/reporters");
	const reporter = new CoverageReporter(config, { firstRun: false, changedFiles: undefined });
	for (const coverage of reports) reporter.onTestResult({}, { coverage });
	await reporter.onRunComplete(new Set(), {});
	if (reporter.getLastError()) throw reporter.getLastError();
	if (options.runnerPlayer) {
		const combined = coverageLibrary.createCoverageMap({});
		for (const report of reports) combined.merge(report);
		const result = evaluateRunnerPlayerCoverage(combined.toJSON(), options.runnerSource);
		if (!result.ok) throw new Error(result.errors.join("; "));
	}
}

export async function mergeCoverage(directory) {
	const sourceFingerprint = coverageSourceFingerprint();
	for (const path of ["coverage/coverage-final.json", "coverage/lcov.info"]) rmSync(path, { force: true });
	rmSync("coverage/runner-feature", { recursive: true, force: true });
	const paths = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { encoding: "utf8" }));
	const expected = Object.fromEntries(Object.entries(execution.partitionTests(paths)).map(([lane, tests]) => [lane, tests.map((path) => relative(process.cwd(), path))]));
	expected.workflows = (await import("./run-mcp-workflow-coverage.mjs")).workflowInventory();
	const folders = readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(directory, entry.name));
	validateLanes(
		folders.map((folder) => JSON.parse(readFileSync(join(folder, "lane.json"), "utf8"))),
		expected,
		execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
		sourceFingerprint,
	);
	const { projectConfig, globalConfig } = await require("jest-config").readConfig({}, process.cwd());
	await enforceJestCoverage(
		folders.map((folder) => JSON.parse(readFileSync(join(folder, "coverage-final.json"), "utf8"))),
		{ ...globalConfig, coverageThreshold: projectConfig.coverageThreshold ?? globalConfig.coverageThreshold, coverageDirectory: resolve("coverage"), coverageReporters: ["json", "text-summary", "lcov"] },
		{ runnerPlayer: true },
	);
	const report = JSON.parse(readFileSync("coverage/coverage-final.json", "utf8"));
	const mcp = evaluateMcpCoverage(report);
	if (!mcp.ok) throw new Error(`MCP source coverage failed: ${JSON.stringify(mcp)}`);
	if (coverageSourceFingerprint() !== sourceFingerprint) throw new Error("Coverage execution inputs changed during the merge");
	const policy = JSON.parse(readFileSync(new URL("./runner-feature-coverage.json", import.meta.url), "utf8"));
	const selected = new Set([...policy.critical, ...policy.ordinary, policy.legacy.path]);
	const feature = Object.fromEntries(Object.entries(report).filter(([path]) => selected.has(relative(process.cwd(), resolve(path)).replaceAll("\\", "/"))));
	if (Object.keys(feature).length !== selected.size) throw new Error("Runner feature report has a missing or duplicate source");
	mkdirSync("coverage/runner-feature", { recursive: true });
	writeFileSync("coverage/runner-feature/coverage-final.json", JSON.stringify(feature, null, 2) + "\n");
	writeFileSync("coverage/runner-feature/gate.json", JSON.stringify({ ok: true, sourceFingerprint, sources: [...selected].sort(), strictCritical: policy.critical, criticalFloors: { statements: 95, functions: 95, lines: 95, branches: 90 }, ordinaryFloors: { statements: 90, functions: 90, lines: 90, branches: 85 }, legacy: evaluateRunnerPlayerCoverage(report) }, null, 2) + "\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await mergeCoverage(process.argv[2] ?? "coverage-lanes");
