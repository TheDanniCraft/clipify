import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import yaml from "yaml";

const ci = yaml.parse(readFileSync(".github/workflows/ci.yml", "utf8"));
const native = yaml.parse(readFileSync(".github/workflows/runner-native.yml", "utf8"));
const guard = ci.jobs.test.steps.find((step) => step.name?.includes("Require complete validation"));
for (const field of ["FULL", "COVERAGE", "BROWSER"]) {
	test(`mandatory Test gate retains its existing ${field} refusal`, () => {
		const env = { ...process.env, FULL: "true", COVERAGE: "success", BROWSER: "success", RUNNER_REQUIRED: "true", RUNNER: "success", [field]: field === "FULL" ? "false" : "failure" };
		assert.notEqual(spawnSync("bash", ["-e", "-c", guard.run], { env }).status, 0);
	});
}
for (const status of ["failure", "cancelled", "skipped"]) {
	test(`mandatory Test gate rejects a required native result of ${status}`, () => {
		const result = spawnSync("bash", ["-e", "-c", guard.run], { env: { ...process.env, FULL: "true", COVERAGE: "success", BROWSER: "success", RUNNER_REQUIRED: "true", RUNNER: status } });
		assert.notEqual(result.status, 0);
	});
}
test("mandatory Test gate permits unchanged Runner scope and requires the actual native job", () => {
	assert.ok(ci.jobs.test.needs.includes("runner"));
	assert.ok(ci.jobs.test.needs.includes("runner-coverage"));
	assert.equal(guard.env.RUNNER, "${{ needs.runner-coverage.result }}");
	assert.equal(guard.env.RUNNER_REQUIRED, "${{ needs.changes.outputs.runner }}");
	assert.ok(ci.jobs.runner.steps.some((step) => step.run?.includes("run-runner-coverage-lane.mjs")));
	assert.ok(ci.jobs["runner-coverage"].steps.some((step) => step.run?.includes("merge-runner-coverage.mjs")));
	for (const [required, status] of [
		["false", "skipped"],
		["true", "success"],
	])
		assert.equal(spawnSync("bash", ["-e", "-c", guard.run], { env: { ...process.env, FULL: "true", COVERAGE: "success", BROWSER: "success", RUNNER_REQUIRED: required, RUNNER: status } }).status, 0);
});
test("coverage merger uses the same pinned Node as the owning lanes", () => {
	const node = (job) => job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"))?.with?.["node-version"];
	assert.equal(node(ci.jobs.test), node(ci.jobs["coverage-lanes"]));
	assert.equal(node(ci.jobs.runner), node(ci.jobs["coverage-lanes"]));
});
test("every official native platform checks out identical LF source before fingerprinting", () => {
	const checkout = native.jobs.build.steps.findIndex((step) => step.uses?.startsWith("actions/checkout@"));
	assert.ok(native.jobs.build.steps.slice(0, checkout).some((step) => step.shell === "bash" && /git config --global core.autocrlf false/.test(step.run)));
});
test("native coverage collects all Runner modules and keeps critical95/90 and ordinary90/85 floors", () => {
	const require = createRequire(import.meta.url);
	const config = require("../packages/runner/jest.config.cjs");
	const critical = ["startup-recovery", "execution-runtime", "execution-journal", "execution-keys", "terminal-credentials", "terminal-delivery", "storage", "schedule-cache", "presentation-bootstrap"];
	const ordinary = ["engine", "index", "output", "presentation", "schedule"];
	assert.deepEqual([...(config.collectCoverageFrom ?? [])].sort(), [...critical, ...ordinary].map((name) => `src/${name}.ts`).sort());
	assert.deepEqual(config.coverageThreshold.global, { statements: 90, functions: 90, lines: 90, branches: 85 });
	for (const name of critical) assert.deepEqual(config.coverageThreshold[`./src/${name}.ts`], { statements: 95, functions: 95, lines: 95, branches: 90 });
});
