import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { coverageSourceFingerprint } from "./coverage-source-fingerprint.mjs";
import { enforceJestCoverage } from "./merge-test-coverage.mjs";
import { validateRunnerCoverageEvidence } from "../packages/runner/run-coverage.mjs";
import sharding from "./runner-test-sharding.cjs";
const require = createRequire(import.meta.url);
export function nativeCoverageThresholds(thresholds) {
	// Jest resolves file thresholds from cwd; this merger runs at the repository root.
	return Object.fromEntries(Object.entries(thresholds).map(([path, value]) => [path === "global" ? path : resolve(sharding.directory, path), value]));
}

export function validateRunnerShardMetadata(rows, expected, fingerprint) {
	if (!/^[a-f0-9]{64}$/.test(fingerprint) || rows.length !== expected.length) throw Error("Missing Runner shard evidence");
	const seen = new Set();
	for (const row of rows) {
		if (seen.has(row.index) || row.count !== expected.length || !expected[row.index - 1] || JSON.stringify([...row.owners].sort()) !== JSON.stringify([...expected[row.index - 1]].sort()) || row.sourceFingerprint !== fingerprint || row.node !== process.version || row.platform !== process.platform || row.arch !== process.arch || row.imageVersion !== (process.env.ImageVersion ?? null)) throw Error("Duplicate, incomplete or foreign Runner shard evidence");
		seen.add(row.index);
	}
}
export async function mergeRunnerCoverage(input, planFile) {
	const fingerprint = coverageSourceFingerprint(resolve(sharding.directory, "../..")),
		plan = JSON.parse(readFileSync(planFile, "utf8"));
	const owners = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { cwd: sharding.directory, encoding: "utf8" }))
		.map(sharding.normalize)
		.sort();
	const planned = plan.shards.flat().sort();
	if (new Set(planned).size !== planned.length || JSON.stringify(owners) !== JSON.stringify(planned)) throw Error("Incomplete current Runner plan");
	const folders = readdirSync(input, { withFileTypes: true })
		.filter((f) => f.isDirectory())
		.map((f) => join(input, f.name));
	validateRunnerShardMetadata(
		folders.map((f) => JSON.parse(readFileSync(join(f, "shard.json"), "utf8"))),
		plan.shards,
		fingerprint,
	);
	const reports = [],
		results = [];
	for (const folder of folders) {
		const meta = JSON.parse(readFileSync(join(folder, "shard.json"), "utf8"));
		if (meta.reportSha256 !== sharding.fileHash(join(folder, "coverage-final.json")) || meta.resultsSha256 !== sharding.fileHash(join(folder, "jest-results.json"))) throw Error("Runner shard content hash mismatch");
		reports.push(JSON.parse(readFileSync(join(folder, "coverage-final.json"), "utf8")));
		results.push(JSON.parse(readFileSync(join(folder, "jest-results.json"), "utf8")));
	}
	const output = resolve(sharding.directory, "coverage/runner-feature");
	rmSync(output, { recursive: true, force: true });
	mkdirSync(output, { recursive: true });
	const { globalConfig, projectConfig } = await require("jest-config").readConfig({ config: resolve(sharding.directory, "jest.config.cjs") }, sharding.directory);
	await enforceJestCoverage(reports, { ...globalConfig, coverageThreshold: nativeCoverageThresholds(projectConfig.coverageThreshold ?? globalConfig.coverageThreshold), coverageDirectory: output, coverageReporters: ["json", "text-summary", "lcov"] });
	const combined = { success: results.every((r) => r.success), testResults: results.flatMap((r) => r.testResults) };
	for (const field of ["numFailedTests", "numFailedTestSuites", "numPendingTests", "numRuntimeErrorTestSuites", "numPassedTests", "numTodoTests"]) combined[field] = results.reduce((n, r) => n + (r[field] ?? 0), 0);
	const report = JSON.parse(readFileSync(join(output, "coverage-final.json"), "utf8")),
		validation = validateRunnerCoverageEvidence(combined, report, owners);
	if (!validation.ok || coverageSourceFingerprint(resolve(sharding.directory, "../..")) !== fingerprint) throw Error("Invalid complete Runner evidence: " + validation.errors.join("; "));
	writeFileSync(join(output, "jest-results.json"), JSON.stringify(combined));
	writeFileSync(join(output, "execution-inputs.json"), JSON.stringify({ ...validation, sourceFingerprint: fingerprint, node: process.version, reportSha256: sharding.fileHash(join(output, "coverage-final.json")), passed: combined.numPassedTests, inheritedTodo: combined.numTodoTests }, null, 2) + "\n");
	const timings = Object.fromEntries(combined.testResults.map((s) => ["packages/runner/" + sharding.normalize(s.name), Math.max(0.001, (s.endTime - s.startTime) / 1000)]));
	writeFileSync(join(output, "runner-durations.json"), JSON.stringify(timings, null, 2) + "\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await mergeRunnerCoverage(process.argv[2], process.argv[3]);
