import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { buildMcpCoverageProbes } from "./build-mcp-coverage-probes.mjs";
import execution from "./test-execution.cjs";
import { resetWorkflowCoverageArtifacts } from "./workflow-coverage-state.mjs";
import { coverageSourceFingerprint } from "./coverage-source-fingerprint.mjs";

const lane = process.argv[2];
const outputDirectory = resolve("coverage", lane);
mkdirSync(outputDirectory, { recursive: true });
rmSync(join(outputDirectory, "lane.json"), { force: true });
const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const sourceFingerprint = coverageSourceFingerprint();
const run = (args, env) => {
	const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Coverage lane ${lane} failed (${result.status})`);
};
let tests;
if (lane === "workflows") {
	resetWorkflowCoverageArtifacts(outputDirectory);
	const probes = join(outputDirectory, "probes"),
		raw = join(outputDirectory, "raw");
	await buildMcpCoverageProbes({ outputDirectory: probes, instrument: true });
	writeFileSync(join(outputDirectory, "coverage-final.json"), "{}\n");
	const environment = { ...process.env, MCP_PROBE_RUNTIME: "node", MCP_PROBE_COVERAGE_PROVIDER: "istanbul", MCP_COVERAGE_PROBE_DIRECTORY: probes, MCP_V8_COVERAGE_DIR: raw };
	const { collectMcpWorkflowCoverage } = await import("./run-mcp-workflow-coverage.mjs");
	if (!(await collectMcpWorkflowCoverage({ environment, rawDirectory: raw, outputDirectory }))) throw new Error("Workflow scenarios failed");
	tests = JSON.parse(readFileSync(join(outputDirectory, "workflow-inventory.json"), "utf8"));
	rmSync(probes, { recursive: true, force: true });
	rmSync(raw, { recursive: true, force: true });
} else {
	const list = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { encoding: "utf8" }));
	const partitions = execution.partitionTests(list);
	if (!Object.hasOwn(partitions, lane) || !partitions[lane].length) throw new Error(`Empty or unknown lane: ${lane}`);
	tests = partitions[lane].map((path) => relative(process.cwd(), path));
	const results = join(outputDirectory, "jest-results.json");
	run(["scripts/run-mcp-coverage.mjs", "--partial-lane", "--filter=./scripts/test-lane-filter.cjs", `--coverageDirectory=${outputDirectory}`, "--json", `--outputFile=${results}`], { ...process.env, CLIPIFY_TEST_LANE: lane });
	const executed = JSON.parse(readFileSync(results, "utf8"))
		.testResults.map((result) => relative(process.cwd(), result.name))
		.sort();
	if (JSON.stringify(executed) !== JSON.stringify([...tests].sort())) throw new Error("Coverage lane did not execute its complete inventory");
}
if (coverageSourceFingerprint() !== sourceFingerprint) throw new Error("Coverage execution inputs changed while the lane was running");
writeFileSync(join(outputDirectory, "lane.json"), JSON.stringify({ lane, tree, sourceFingerprint, tests }, null, 2) + "\n");
