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
	assert.equal(ci.jobs["browser-tests"].strategy.matrix, "${{ fromJSON(needs.validation-plan.outputs.browser_matrix) }}");
	assert.ok(ci.jobs["validation-plan"].steps.some((step) => step.id === "browser"));
	assert.ok(ci.jobs["browser-tests"].env.INSTANCE_HEALTH_TOKEN, "health acceptance requires explicit CI runtime authentication");
	assert.ok(ci.jobs.test.steps.some((step) => step.run?.includes("update-browser-durations")));
});

test("CI metadata planning loads the real Playwright config without enabling database fixtures", () => {
	const yaml = require("yaml"),
		{ spawnSync } = require("node:child_process");
	const ci = yaml.parse(readFileSync(".github/workflows/ci.yml", "utf8"));
	const build = ci.jobs["browser-build"],
		step = ci.jobs["validation-plan"];
	const env = { ...process.env, ...build.env, ...step.env, CI: "true" };
	delete env.DATABASE_URL;
	delete env.MCP_BROWSER_DATABASE_URL;
	for (const key of ["JWT_SECRET", "BETTER_AUTH_SECRET", "MCP_TEST_DATABASE_URL", "MCP_TEST_TEMPLATE_ID", "APP_ENV", "E2E_TEST_MODE", "CLIPIFY_E2E_SCHEMA_PUSH"]) delete env[key];
	delete env.GITHUB_OUTPUT;
	delete env.GITHUB_STEP_SUMMARY;
	const result = spawnSync(process.execPath, ["node_modules/playwright-bdd/dist/cli/index.js"], { env, encoding: "utf8", timeout: 30000 });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(build.env.MCP_BROWSER_PROVIDER_FIXTURE, "true");
	assert.equal(step.env.MCP_BROWSER_PROVIDER_FIXTURE, "false");
	const planned = spawnSync(process.execPath, ["scripts/plan-browser-shards.cjs"], { env, encoding: "utf8", timeout: 30000 });
	assert.equal(planned.status, 0, planned.stderr);
	const plan = JSON.parse(readFileSync("test-results/browser-shard-plan.json", "utf8"));
	assert.ok(plan.shards.length > 6);
	assert.ok(plan.shards.every((shard) => shard.testIds.length > 0));
	assert.ok(plan.shards.filter((shard) => shard.selectors.some((selector) => selector.includes("/runner-free-pro.feature.spec.js ›"))).length > 1);
	const steps = ci.jobs["browser-tests"].steps;
	for (const name of ["📦 Install BDD native presentation dependencies", "🌐 Prepare BDD native presentation browser", "🎞️ Install BDD native media system dependencies"]) assert.equal(steps.find((step) => step.name === name).if, "matrix.native_media == true");
	assert.equal(steps.find((step) => step.name === "🎞️ Prepare frame decoding only where required").if, "matrix.ffmpeg == true && matrix.native_media != true");
});
