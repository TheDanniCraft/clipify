import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import databaseBudget from "./test-database-budget.cjs";
import workerBudget from "./test-worker-budget.cjs";
import coverageRanges from "./mcp-coverage-ranges.cjs";
import McpCoverageReporter from "./mcp-coverage-reporter.cjs";

const require = createRequire(import.meta.url);
const nativeProjects = ["bdd-chromium", "atdd-chromium"];
const nativeProjectArguments = nativeProjects.map((project) => `--project=${project}`);

function scenarioIds(report) {
	const ids = [];
	const owned = new Set();
	const visit = (suite) => {
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests) {
				if (typeof spec.id !== "string" || !spec.id || !nativeProjects.includes(test.projectName) || owned.has(spec.id)) throw new Error("Workflow scenarios must have exactly one execution owner");
				owned.add(spec.id);
				ids.push(`${spec.id}:${test.projectName}`);
			}
		}
		for (const child of suite.suites ?? []) visit(child);
	};
	for (const suite of report.suites) visit(suite);
	if (!ids.length) throw new Error("Workflow scenario inventory is empty");
	return ids.sort();
}

export function combinedWorkflowInventory(reports) {
	const ids = reports.flatMap((report) => scenarioIds(report));
	if (new Set(ids).size !== ids.length) throw new Error("Workflow scenarios must have exactly one execution owner");
	return ids.sort();
}

export function workflowInventory() {
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	return combinedWorkflowInventory([JSON.parse(execFileSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))]);
}

export function workflowExecutionCommands(workers, playwright = require.resolve("@playwright/test/cli")) {
	return [
		[playwright, "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, `--workers=${workers}`, "--grep-invert", "@mode:serial", "--reporter=line,json"],
		[playwright, "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, "--workers=1", "--retries=1", "--grep", "@mode:serial", "--reporter=line,json"],
	];
}

function runWorkflowCommand(args, environment, resultFile) {
	const result = spawnSync(process.versions.bun ? "node" : process.execPath, args, { env: { ...environment, PLAYWRIGHT_JSON_OUTPUT_NAME: resultFile }, stdio: "inherit" });
	if (result.error) throw result.error;
	return result.status === 0;
}

export function collectSerialMcpWorkflowCoverage({ environment, outputDirectory }) {
	const generator = join(dirname(require.resolve("playwright-bdd/package.json")), "dist/cli/index.js");
	const serialResultFile = join(outputDirectory, "workflow-results-serial.json");
	if (!runWorkflowCommand([generator, "--config", "playwright.mcp.config.ts"], environment, serialResultFile)) return false;
	return runWorkflowCommand(workflowExecutionCommands(1)[1], environment, serialResultFile);
}

/** Include the real workflow/feedback journeys in the same fresh source report as Jest. */
export async function collectMcpWorkflowCoverage({ environment, rawDirectory, outputDirectory, serialPrepared = false }) {
	const capacity = await databaseBudget.readFixtureDatabaseCapacity();
	const workers = databaseBudget.selectDatabaseWorkers(workerBudget.automaticTestWorkers(), capacity);
	const parallelResultFile = join(outputDirectory, "workflow-results-parallel.json");
	const serialResultFile = join(outputDirectory, "workflow-results-serial.json");
	if (!serialPrepared && !collectSerialMcpWorkflowCoverage({ environment, outputDirectory })) return false;
	if (!runWorkflowCommand(workflowExecutionCommands(workers)[0], environment, parallelResultFile)) return false;
	const expected = workflowInventory();
	const executed = [parallelResultFile, serialResultFile].map((file) => JSON.parse(readFileSync(file, "utf8")));
	if (!expected.length || executed.some((report) => report.stats.skipped || report.stats.unexpected) || JSON.stringify(combinedWorkflowInventory(executed)) !== JSON.stringify(expected)) throw new Error("Workflow coverage did not execute its complete scenario inventory");
	writeFileSync(join(outputDirectory, "workflow-inventory.json"), JSON.stringify(expected));
	const reporter = new McpCoverageReporter({ collectCoverage: true }, { rawDirectory, outputDirectory: join(outputDirectory, "mcp-workflows") });
	const result = { coverage: {} };
	await reporter.onTestResult({}, result);
	if (reporter.getLastError()) throw reporter.getLastError();
	if (!Object.keys(result.coverage).length) throw new Error("Workflow journeys produced no source coverage");
	const { createCoverageMap } = require("istanbul-lib-coverage");
	const finalReport = join(outputDirectory, "coverage-final.json");
	const map = createCoverageMap(coverageRanges.repairMappedCoverage(JSON.parse(readFileSync(finalReport, "utf8"))));
	map.merge(coverageRanges.repairMappedCoverage(JSON.parse(JSON.stringify(result.coverage))));
	writeFileSync(finalReport, JSON.stringify(coverageRanges.repairMappedCoverage(JSON.parse(JSON.stringify(map.toJSON()))), null, 2));
	return true;
}
