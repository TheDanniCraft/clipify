/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { partitionTests, fullValidationRequired, selectBrowserFiles } = require("./test-execution.cjs");

test("every suite has one owner and timing proofs stay isolated", () => {
	const paths = ["test/app/page.test.tsx", "test/mcp/integration/a.test.ts", "test/mcp/integration/b.test.ts", "test/mcp/integration/c.test.ts", "test/mcp/unit/runtime-boundaries.test.ts"];
	const lanes = partitionTests(paths);
	assert.deepEqual(Object.values(lanes).flat().sort(), [...paths].sort());
	assert.deepEqual(lanes.quiet, [paths[4]]);
	assert.deepEqual(lanes.unit, [paths[0]]);
});
test("Jest filter returns the exact string-path contract rather than wrapping paths", async () => {
	const previous = process.env.CLIPIFY_TEST_LANE;
	const previousPlan = process.env.CLIPIFY_WORKFLOW_SHARD_PLAN;
	delete process.env.CLIPIFY_WORKFLOW_SHARD_PLAN;
	process.env.CLIPIFY_TEST_LANE = "quiet";
	try {
		const paths = ["test/app/page.test.tsx", "test/mcp/unit/runtime-boundaries.test.ts"];
		assert.deepEqual(await require("./test-lane-filter.cjs")(paths), { filtered: [paths[1]] });
	} finally {
		if (previousPlan !== undefined) process.env.CLIPIFY_WORKFLOW_SHARD_PLAN = previousPlan;
		if (previous === undefined) delete process.env.CLIPIFY_TEST_LANE;
		else process.env.CLIPIFY_TEST_LANE = previous;
	}
});
test("ready PRs, master and unknown events require complete validation", () => {
	assert.equal(fullValidationRequired({ pull_request: { draft: true } }, "pull_request"), false);
	assert.equal(fullValidationRequired({ pull_request: { draft: false } }, "pull_request"), true);
	assert.equal(fullValidationRequired({}, "push"), true);
	assert.equal(fullValidationRequired({}, "pull_request"), true);
});
test("native workflow scenarios have one owner; browser shards remain exhaustive", () => {
	const files = ["bdd/mcp-workflows/authority.spec.js", "bdd/mcp-support/browser.spec.js", "bdd/login.spec.js"];
	const parts = Array.from({ length: 3 }, (_, i) => selectBrowserFiles(files, i, 3));
	assert.deepEqual(parts.flat().sort(), files.slice(1).sort());
});
test("CI keeps a mandatory complete gate and triggers when a draft becomes ready", () => {
	const yaml = require("yaml");
	const workflow = yaml.parse(require("node:fs").readFileSync(".github/workflows/ci.yml", "utf8"));
	assert.ok(workflow.on.pull_request.types.includes("ready_for_review"));
	assert.ok(workflow.jobs.test.needs.includes("coverage-lanes"));
	assert.ok(workflow.jobs.test.needs.includes("browser-tests"));
	assert.equal(workflow.jobs.test.if, "${{ !cancelled() }}");
	assert.equal(workflow.jobs["coverage-lanes"].strategy.matrix, "${{ fromJSON(needs.validation-plan.outputs.coverage_matrix) }}");
	assert.ok(workflow.jobs["coverage-lanes"].needs.includes("validation-plan"));
	assert.ok(workflow.jobs["browser-tests"].needs.includes("browser-build"));
	assert.match(workflow.jobs.changes.steps.find((step) => step.id === "mode").run, /fullValidationRequired/);
});

test("Runner database-backed contracts and health sweeps use a database coverage lane", () => {
	const paths = ["test/server/runner/admission.test.ts", "test/app/lib/runnerScheduler.test.ts"];
	const lanes = partitionTests(paths);
	assert.deepEqual(lanes.unit, []);
	assert.deepEqual([lanes["database-1"], lanes["database-2"], lanes["database-3"]].flat().sort(), paths.sort());
});

test("application lane counts grow from measured work while retaining all files", () => {
	const { planApplicationLanes } = require("./test-execution.cjs");
	const paths = Array.from({ length: 30 }, (_, i) => `test/mcp/integration/case-${i}.test.ts`),
		profile = Object.fromEntries(paths.map((p) => [p, 100]));
	const options = planApplicationLanes(paths, profile, 1),
		parts = partitionTests(paths, options);
	assert.equal(options.databaseCount, 10);
	assert.deepEqual(Object.values(parts).flat().sort(), paths.sort());
});
