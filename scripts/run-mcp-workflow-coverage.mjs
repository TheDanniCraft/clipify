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

function plannedWorkflowLane(lane) {
	if (!lane || !process.env.CLIPIFY_WORKFLOW_SHARD_PLAN) return undefined;
	const plan = JSON.parse(readFileSync(process.env.CLIPIFY_WORKFLOW_SHARD_PLAN, "utf8"));
	if (!plan.lanes?.[lane]) throw new Error(`Unknown planned workflow lane: ${lane}`);
	return plan.lanes[lane];
}
export function workflowLaneNames() {
	if (!process.env.CLIPIFY_WORKFLOW_SHARD_PLAN) return ["workflows-1", "workflows-2", "workflows-media"];
	const lanes = Object.keys(JSON.parse(readFileSync(process.env.CLIPIFY_WORKFLOW_SHARD_PLAN, "utf8")).lanes ?? {});
	if (!lanes.length) throw new Error("Empty native workflow plan");
	return lanes;
}

export function workflowLaneSelection(lane) {
	if (!lane || lane === "workflows") return { parallel: true, serial: true, shard: [] };
	if (lane === "workflows-media") return { parallel: false, serial: true, shard: [] };
	if (/^workflows-[12]$/.test(lane)) return { parallel: true, serial: false, shard: [`--shard=${lane.at(-1)}/2`] };
	throw new Error(`Unknown workflow lane: ${lane}`);
}

export function workflowInventory(lane) {
	const planned = plannedWorkflowLane(lane);
	if (planned) return [...planned.testIds].sort();
	const selection = workflowLaneSelection(lane);
	const filters = selection.parallel && selection.serial ? [] : selection.serial ? ["--grep", "@mode:serial"] : ["--grep-invert", "@mode:serial", ...selection.shard];
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	return combinedWorkflowInventory([JSON.parse(execFileSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, ...filters, "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))]);
}

export function workflowExecutionCommands(workers, playwright = require.resolve("@playwright/test/cli"), lane) {
	const selection = workflowLaneSelection(lane);
	return [
		[playwright, "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, `--workers=${workers}`, ...selection.shard, "--grep-invert", "@mode:serial", "--reporter=line,json"],
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
export async function collectMcpWorkflowCoverage({ environment, rawDirectory, outputDirectory, serialPrepared = false, lane }) {
	const planned = plannedWorkflowLane(lane);
	const selection = planned ? { parallel: planned.kind === "protocol", serial: planned.kind === "media", shard: [] } : workflowLaneSelection(lane);
	const capacity = await databaseBudget.readFixtureDatabaseCapacity();
	const workers = databaseBudget.selectDatabaseWorkers(workerBudget.automaticTestWorkers(), capacity);
	const parallelResultFile = join(outputDirectory, "workflow-results-parallel.json");
	const serialResultFile = join(outputDirectory, "workflow-results-serial.json");
	if (planned) {
		const generator = join(dirname(require.resolve("playwright-bdd/package.json")), "dist/cli/index.js");
		if (!runWorkflowCommand([generator, "--config", "playwright.mcp.config.ts"], environment, selection.serial ? serialResultFile : parallelResultFile)) return false;
		const list = join(outputDirectory, "workflow-test-list.txt");
		writeFileSync(list, planned.selectors.join("\n") + "\n");
		const command = [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.mcp.config.ts", ...nativeProjectArguments, "--test-list", list, `--workers=${selection.serial ? 1 : workers}`, ...(selection.serial ? ["--grep", "@mode:serial", "--retries=1"] : ["--grep-invert", "@mode:serial"]), "--reporter=line,json"];
		if (!runWorkflowCommand(command, environment, selection.serial ? serialResultFile : parallelResultFile)) return false;
	} else {
		if (selection.serial && !serialPrepared && !collectSerialMcpWorkflowCoverage({ environment, outputDirectory })) return false;
		if (selection.parallel && !runWorkflowCommand(workflowExecutionCommands(workers, undefined, lane)[0], environment, parallelResultFile)) return false;
	}
	const expected = workflowInventory(lane);
	const executed = [...(selection.parallel ? [parallelResultFile] : []), ...(selection.serial ? [serialResultFile] : [])].map((file) => JSON.parse(readFileSync(file, "utf8")));
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
