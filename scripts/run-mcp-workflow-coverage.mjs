import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import databaseBudget from "./test-database-budget.cjs";
import workerBudget from "./test-worker-budget.cjs";
import coverageRanges from "./mcp-coverage-ranges.cjs";
import McpCoverageReporter from "./mcp-coverage-reporter.cjs";

const require = createRequire(import.meta.url);

function scenarioIds(report) {
	const ids = [];
	const visit = (suite) => {
		for (const spec of suite.specs ?? []) for (const test of spec.tests) ids.push(`${spec.id}:${test.projectName}`);
		for (const child of suite.suites ?? []) visit(child);
	};
	for (const suite of report.suites) visit(suite);
	return ids.sort();
}
export function workflowInventory() {
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	return scenarioIds(JSON.parse(execFileSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.mcp.config.ts", "--project=bdd-chromium", "mcp-workflows", "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })));
}

/** Include the real workflow/feedback journeys in the same fresh source report as Jest. */
export async function collectMcpWorkflowCoverage({ environment, rawDirectory, outputDirectory }) {
	const capacity = await databaseBudget.readFixtureDatabaseCapacity();
	const workers = databaseBudget.selectDatabaseWorkers(workerBudget.automaticTestWorkers(), capacity);
	const generator = join(dirname(require.resolve("playwright-bdd/package.json")), "dist/cli/index.js");
	const playwright = require.resolve("@playwright/test/cli");
	const resultFile = join(outputDirectory, "workflow-results.json");
	for (const args of [
		[generator, "--config", "playwright.mcp.config.ts"],
		[playwright, "test", "--config", "playwright.mcp.config.ts", "--project=bdd-chromium", "mcp-workflows", `--workers=${workers}`, "--reporter=line,json"],
	]) {
		const result = spawnSync(process.versions.bun ? "node" : process.execPath, args, { env: { ...environment, PLAYWRIGHT_JSON_OUTPUT_NAME: resultFile }, stdio: "inherit" });
		if (result.error) throw result.error;
		if (result.status !== 0) return false;
	}
	const expected = workflowInventory();
	const executed = JSON.parse(readFileSync(resultFile, "utf8"));
	if (!expected.length || executed.stats.skipped || executed.stats.unexpected || JSON.stringify(scenarioIds(executed)) !== JSON.stringify(expected)) throw new Error("Workflow coverage did not execute its complete scenario inventory");
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
