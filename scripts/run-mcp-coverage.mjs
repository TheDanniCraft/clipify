import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildMcpCoverageProbes } from "./build-mcp-coverage-probes.mjs";
import coverageRanges from "./mcp-coverage-ranges.cjs";
import workerBudget from "./test-worker-budget.cjs";

const args = process.argv.slice(2);
const explicitExecution = args.some((argument) => argument === "--runInBand" || argument === "--maxWorkers" || argument.startsWith("--maxWorkers="));
const automaticArguments = explicitExecution ? [] : [`--maxWorkers=${workerBudget.automaticTestWorkers()}`];
// Configuration inspection does not execute tests or need instrumented probes.
if (args.includes("--showConfig")) {
	const result = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", ...automaticArguments, ...args], { stdio: "inherit", env: process.env });
	if (result.error) throw result.error;
	process.exit(result.status ?? 1);
}
const outputArgument = args.findIndex((argument) => argument === "--coverageDirectory" || argument.startsWith("--coverageDirectory="));
const outputDirectory = resolve(outputArgument < 0 ? (process.env.MCP_COVERAGE_DIRECTORY ?? "coverage") : args[outputArgument].includes("=") ? args[outputArgument].slice(args[outputArgument].indexOf("=") + 1) : args[outputArgument + 1]);
const finalReport = join(outputDirectory, "coverage-final.json");
mkdirSync("test-results/mcp", { recursive: true });
const directory = mkdtempSync(resolve("test-results/mcp/coverage-run-"));
const raw = join(directory, "raw");
const probes = join(directory, "probes");
mkdirSync(raw);
try {
	await buildMcpCoverageProbes({ outputDirectory: probes, instrument: true });
	// A failed report must never make a previous run's JSON look current.
	rmSync(finalReport, { force: true });
	const environment = { ...process.env, MCP_PROBE_RUNTIME: "node", MCP_PROBE_COVERAGE_PROVIDER: "istanbul", MCP_COVERAGE_PROBE_DIRECTORY: probes, MCP_V8_COVERAGE_DIR: raw };
	// Capture only application probes, not Jest and its instrumentation machinery.
	delete environment.NODE_V8_COVERAGE;
	const suite = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", "--coverage", ...automaticArguments, ...args, ...(outputArgument < 0 ? [`--coverageDirectory=${outputDirectory}`] : [])], {
		stdio: "inherit",
		env: environment,
	});
	// Scoped developer checks stay scoped; the complete CI command also includes native BDD workflows.
	const scoped = args.some((argument) => argument.startsWith("test/") || /^(--testPath|--runTestsByPath|--testNamePattern|-t$)/.test(argument));
	const workflowsPassed = scoped || (existsSync(finalReport) && (await (await import("./run-mcp-workflow-coverage.mjs")).collectMcpWorkflowCoverage({ environment, rawDirectory: raw, outputDirectory })));
	// Jest performs a final source remap after per-test reporters. Repair only backwards
	// mapped endpoints; counters and native threshold failure status stay unchanged.
	if (existsSync(finalReport)) writeFileSync(finalReport, JSON.stringify(coverageRanges.repairMappedCoverage(JSON.parse(readFileSync(finalReport, "utf8"))), null, 2) + "\n");
	const gate = spawnSync(process.execPath, ["scripts/check-mcp-coverage.mjs", finalReport], { stdio: "inherit" });
	process.exitCode = suite.status === 0 && workflowsPassed && gate.status === 0 ? 0 : 1;
} finally {
	rmSync(directory, { recursive: true, force: true });
}
