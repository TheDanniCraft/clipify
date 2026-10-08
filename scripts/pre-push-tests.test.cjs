/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectPushChecks, changedPaths } = require("./pre-push-tests.cjs");
test("documentation avoids duplicate application tests", () => assert.deepEqual(selectPushChecks(["specs/003-mcp-support/tasks.md", "graphify-out/graph.json"]), { full: false, paths: [] }));
test("hook changes run their dedicated checks without application changes", () => assert.deepEqual(selectPushChecks([".husky/pre-push", "scripts/pre-push-tests.cjs", "scripts/pre-push-tests.test.cjs"]), { full: false, paths: [] }));
test("UI and its regression tests select related suites", () => assert.deepEqual(selectPushChecks(["src/app/auth/mcp/consent/ConsentForm.tsx", "test/mcp/component/consent.test.tsx"]), { full: false, paths: ["src/app/auth/mcp/consent/ConsentForm.tsx", "test/mcp/component/consent.test.tsx"] }));
test("shared infrastructure and unknown files require the full suite", () => {
	for (const path of ["bun.lock", "package.json", "jest.config.cjs", "test/support/mcp/postgres.ts", "src/db/schema.ts", "src/server/mcp/server.ts", "public/player.js.map"]) assert.equal(selectPushChecks([path]).full, true, path);
});
test("all commits and refs being pushed contribute paths", () => {
	const calls = [];
	const paths = changedPaths("refs/heads/a abc refs/heads/a def\nrefs/heads/b xyz refs/heads/b uvw", (...args) => {
		calls.push(args);
		return args[4] === "abc" ? "src/a.ts" : "src/b.ts";
	});
	assert.deepEqual(paths, ["src/a.ts", "src/b.ts"]);
	assert.equal(calls.length, 2);
});
test("new branches compare to the master merge base", () => {
	const calls = [];
	changedPaths("refs/heads/a abc refs/heads/a 000000", (...args) => {
		calls.push(args);
		return args[0] === "merge-base" ? "base" : "src/a.ts";
	});
	assert.deepEqual(calls[0], ["merge-base", "abc", "origin/master"]);
	assert.equal(calls[1][3], "base");
});
test("deleted refs need no tests and invalid input fails closed", () => {
	assert.deepEqual(
		changedPaths("refs/heads/a 000000 refs/heads/a abc", () => {
			throw Error("unexpected");
		}),
		[],
	);
	assert.throws(() => changedPaths(""));
	assert.throws(() => changedPaths("invalid"));
});

test("Gherkin changes use scoped local checks while browser acceptance stays in CI", () => assert.equal(selectPushChecks(["src/app/auth/mcp/consent/ConsentForm.tsx", "test/bdd/features/mcp-support/sdk_browser.feature"]).full, false));

const migrationWorkflow = { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/master", GITHUB_WORKFLOW: "🗃️ Generate Migrations", CLIPIFY_MIGRATION_WORKFLOW: "true" };
const generatedMigrations = ["drizzle/0025_new_schema.sql", "drizzle/meta/0025_snapshot.json", "drizzle/meta/_journal.json"];
test("migration automation does not require an unrelated application database for generated artifacts", () => {
	assert.deepEqual(selectPushChecks(generatedMigrations, migrationWorkflow), { full: false, paths: [] });
});
test("migration automation still tests source changes and unexpected artifacts", () => {
	for (const path of ["src/db/schema.ts", "src/auth/mcp-options.ts", "drizzle/custom.ts", "drizzle/meta/unexpected.json"]) assert.equal(selectPushChecks([...generatedMigrations, path], migrationWorkflow).full, true, path);
});
test("generated migrations outside their owning workflow retain full push checks", () => {
	for (const environment of [{}, { ...migrationWorkflow, GITHUB_ACTIONS: "false" }, { ...migrationWorkflow, GITHUB_REF: "refs/heads/feature/example" }, { ...migrationWorkflow, GITHUB_WORKFLOW: "🧪 CI" }, { ...migrationWorkflow, CLIPIFY_MIGRATION_WORKFLOW: "false" }]) assert.equal(selectPushChecks(generatedMigrations, environment).full, true);
});
