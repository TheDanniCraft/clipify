import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import execution from "./test-execution.cjs";
import { evaluateMcpCoverage } from "./check-mcp-coverage.mjs";
const require = createRequire(import.meta.url);

export function validateLanes(rows, expected, tree) {
	const lanes = expected;
	const seen = new Set();
	for (const row of rows) {
		if (seen.has(row.lane)) throw new Error(`Duplicate lane ${row.lane}`);
		seen.add(row.lane);
		if (row.tree !== tree) throw new Error("Coverage evidence belongs to another source tree");
		if (!lanes[row.lane] || JSON.stringify([...row.tests].sort()) !== JSON.stringify([...lanes[row.lane]].sort())) throw new Error(`Incorrect inventory for ${row.lane}`);
	}
	for (const lane of Object.keys(lanes)) if (!seen.has(lane)) throw new Error(`Missing lane ${lane}`);
}

export async function enforceJestCoverage(reports, config) {
	const { CoverageReporter } = require("@jest/reporters");
	const reporter = new CoverageReporter(config, { firstRun: false, changedFiles: undefined });
	for (const coverage of reports) reporter.onTestResult({}, { coverage });
	await reporter.onRunComplete(new Set(), {});
	if (reporter.getLastError()) throw reporter.getLastError();
}

export async function mergeCoverage(directory) {
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
	);
	const { projectConfig, globalConfig } = await require("jest-config").readConfig({}, process.cwd());
	await enforceJestCoverage(
		folders.map((folder) => JSON.parse(readFileSync(join(folder, "coverage-final.json"), "utf8"))),
		{ ...globalConfig, coverageThreshold: projectConfig.coverageThreshold ?? globalConfig.coverageThreshold, coverageDirectory: resolve("coverage"), coverageReporters: ["json", "text-summary", "lcov"] },
	);
	const mcp = evaluateMcpCoverage(JSON.parse(readFileSync("coverage/coverage-final.json", "utf8")));
	if (!mcp.ok) throw new Error(`MCP source coverage failed: ${JSON.stringify(mcp)}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await mergeCoverage(process.argv[2] ?? "coverage-lanes");
