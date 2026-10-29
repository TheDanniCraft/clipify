import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { coverageSourceFingerprint } from "./coverage-source-fingerprint.mjs";
import { validateRunnerCoverageEvidence } from "../packages/runner/run-coverage.mjs";
import sharding from "./runner-test-sharding.cjs";
export function validateRunnerPartialEvidence(results, report, owners) {
	const validation = validateRunnerCoverageEvidence(results, report, owners);
	const required = new Set(createRequire(import.meta.url)("../packages/runner/jest.config.cjs").collectCoverageFrom);
	// Unexecuted re-export-only modules may be absent in a producer; the final gate requires all sources.
	if (validation.sources.length && validation.sources.every((path) => required.has(path))) {
		validation.errors = validation.errors.filter((error) => error !== "Missing, duplicated or foreign native source coverage");
		validation.ok = validation.errors.length === 0;
	}
	return validation;
}

export function runRunnerCoverageLane() {
	const match = /^--shard=([1-9]\d*)\/([1-9]\d*)$/.exec(process.argv[2] ?? "");
	if (!match || process.argv.length !== 3) throw Error("One Runner shard is required");
	const index = Number(match[1]),
		count = Number(match[2]);
	const plan = JSON.parse(readFileSync(process.env.RUNNER_TEST_SHARD_PLAN, "utf8"));
	const owners = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { cwd: sharding.directory, encoding: "utf8" }))
		.map(sharding.normalize)
		.sort();
	const planned = plan.shards.flat().sort();
	if (index > count || count !== plan.shards.length || new Set(planned).size !== planned.length || JSON.stringify(owners) !== JSON.stringify(planned)) throw Error("Runner plan must contain every current file exactly once");
	const selected = plan.shards[index - 1],
		output = resolve(sharding.directory, `coverage/runner-shard-${index}`),
		sourceFingerprint = coverageSourceFingerprint(resolve(sharding.directory, "../.."));
	rmSync(output, { recursive: true, force: true });
	mkdirSync(output, { recursive: true });
	const resultsPath = join(output, "jest-results.json"),
		reportPath = join(output, "coverage-final.json");
	// Producers defer thresholds to the mandatory merged native coverage gate.
	const result = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", "--runInBand", "--forceExit", "--runTestsByPath", ...selected, "--coverage", "--coverageThreshold={}", `--coverageDirectory=${output}`, "--json", `--outputFile=${resultsPath}`], { cwd: sharding.directory, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw Error("Runner shard tests failed");
	const results = JSON.parse(readFileSync(resultsPath, "utf8")),
		validation = validateRunnerPartialEvidence(results, JSON.parse(readFileSync(reportPath, "utf8")), selected);
	if (!validation.ok || coverageSourceFingerprint(resolve(sharding.directory, "../..")) !== sourceFingerprint) throw Error("Invalid Runner shard evidence: " + validation.errors.join("; "));
	writeFileSync(join(output, "shard.json"), JSON.stringify({ index, count, owners: selected, sourceFingerprint, node: process.version, platform: process.platform, arch: process.arch, imageOS: process.env.ImageOS ?? null, imageVersion: process.env.ImageVersion ?? null, reportSha256: sharding.fileHash(reportPath), resultsSha256: sharding.fileHash(resultsPath) }, null, 2) + "\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runRunnerCoverageLane();
