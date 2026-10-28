/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { partitionTests, selectBrowserFiles, nativeScenarioPatterns } = require("./test-execution.cjs");

test("local hooks retain migration validation without running application suites", () => {
	const commit = readFileSync(".husky/pre-commit", "utf8");
	assert.match(commit, /check-drizzle-migration-policy/);
	assert.match(commit, /git:staged/);
	assert.doesNotMatch(commit, /typecheck|test:|jest|playwright/);
	assert.doesNotMatch(readFileSync(".husky/pre-push", "utf8"), /pre-push-tests|test:coverage|jest|playwright/);
});
test("authority matrices run in parallel while actual provider deadlines remain isolated", () => {
	const paths = ["test/mcp/integration/authorization-entitlements.test.ts", "test/mcp/integration/authorization-provider-deadline.test.ts"];
	const lanes = partitionTests(paths);
	assert.deepEqual(lanes.quiet, [paths[1]]);
	assert.ok([lanes["database-1"], lanes["database-2"], lanes["database-3"]].flat().includes(paths[0]));
});
test("authority catalogues have a native owner and are excluded from browser execution", () => {
	const files = [".features-gen/bdd/mcp-support/read_authority.feature.spec.js", ".features-gen/bdd/mcp-support/mutation_authority.feature.spec.js", ".features-gen/bdd/mcp-support/browser_overlay_save_ui.feature.spec.js"];
	assert.deepEqual(selectBrowserFiles(files, 0, 1), [files[2]]);
	assert.ok(nativeScenarioPatterns.includes("**/mcp-support/read_authority.feature.spec.js"));
	assert.ok(nativeScenarioPatterns.includes("**/mcp-support/mutation_authority.feature.spec.js"));
});

test("title edits get a fast dedicated Gitmoji check and browser matrices use an immutable plan", () => {
	const yaml = require("yaml");
	const title = yaml.parse(readFileSync(".github/workflows/pr-title.yml", "utf8"));
	assert.ok(title.on.pull_request.types.includes("edited"));
	assert.match(title.jobs.title.steps.at(-1).run, /check-pr-title/);
	const ci = yaml.parse(readFileSync(".github/workflows/ci.yml", "utf8"));
	assert.equal(ci.jobs["browser-tests"].strategy.matrix, "${{ fromJSON(needs.browser-build.outputs.matrix) }}");
	assert.ok(ci.jobs["browser-build"].steps.some((step) => step.id === "shards"));
	assert.ok(ci.jobs.test.steps.some((step) => step.run?.includes("update-browser-durations")));
});
