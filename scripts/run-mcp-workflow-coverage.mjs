import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import databaseBudget from "./test-database-budget.cjs";
import workerBudget from "./test-worker-budget.cjs";
import coverageRanges from "./mcp-coverage-ranges.cjs";
import McpCoverageReporter from "./mcp-coverage-reporter.cjs";

const require = createRequire(import.meta.url);

/** Include the real workflow/feedback journeys in the same fresh source report as Jest. */
export async function collectMcpWorkflowCoverage({ environment, rawDirectory, outputDirectory }) {
	const capacity = await databaseBudget.readFixtureDatabaseCapacity();
	const workers = databaseBudget.selectDatabaseWorkers(workerBudget.automaticTestWorkers(), capacity);
	const generator = join(dirname(require.resolve("playwright-bdd/package.json")), "dist/cli/index.js");
	const playwright = require.resolve("@playwright/test/cli");
	for (const args of [
		[generator, "--config", "playwright.mcp.config.ts"],
		[playwright, "test", "--config", "playwright.mcp.config.ts", "--project=bdd-chromium", "mcp-workflows", `--workers=${workers}`, "--reporter=line"],
	]) {
		const result = spawnSync(process.versions.bun ? "node" : process.execPath, args, { env: environment, stdio: "inherit" });
		if (result.error) throw result.error;
		if (result.status !== 0) return false;
	}
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
