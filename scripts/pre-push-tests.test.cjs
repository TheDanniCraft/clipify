/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectPushChecks, changedPaths, isolatedTestEnvironment } = require("./pre-push-tests.cjs");
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

test("self-test children cannot consume the ref input needed for scoped checks", () => {
	const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
	const { tmpdir } = require("node:os");
	const { join } = require("node:path");
	const { spawnSync } = require("node:child_process");
	const directory = mkdtempSync(join(tmpdir(), "clipify-push-stdin-"));
	try {
		const preload = join(directory, "child-boundary.cjs");
		writeFileSync(preload, `const fs=require('node:fs'),child=require('node:child_process');child.execFileSync=()=> 'README.md';child.spawnSync=(command)=>{if(command!==process.execPath)throw Error('Unexpected application suite');fs.readFileSync(0,'utf8');return {status:0};};`);
		const result = spawnSync(process.execPath, ["--require", preload, join(__dirname, "pre-push-tests.cjs")], { input: "refs/heads/a abc refs/heads/a def\n", encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /No application files changed/);
		assert.doesNotMatch(result.stdout, /Cannot determine changed files/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("push execution honors coverage ownership and blocks failures", () => {
	const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
	const { tmpdir } = require("node:os");
	const { join } = require("node:path");
	const { spawnSync } = require("node:child_process");
	const directory = mkdtempSync(join(tmpdir(), "clipify-push-owners-"));
	try {
		for (const [paths, expected, status] of [
			["package.json", "application-coverage", 1],
			["packages/runner/src/engine.ts", "native-coverage", 1],
			["packages/runner/src/engine.ts", "native-policy", 1],
			["src/app/components/example.tsx", "related-tests", 1],
			["packages/runner/src/engine.ts", "native-coverage", 0],
		]) {
			const preload = join(directory, "child-boundary.cjs");
			writeFileSync(
				preload,
				`const child=require('node:child_process');child.execFileSync=()=>${JSON.stringify(paths)};child.spawnSync=(command,args,options)=>{if(args[0].endsWith('pre-push-tests.test.cjs'))return {status:0};const owner=args[0].endsWith('runner-ci-policy.test.mjs')?'native-policy':options.cwd==='packages/runner'?'native-coverage':command==='bun'&&args.join(' ')==='run test:coverage'?'application-coverage':args[0].endsWith('run-scoped-tests.mjs')?'related-tests':'unexpected';console.log(owner);return {status:owner===${JSON.stringify(expected)}?${status}:0};};`,
			);
			const result = spawnSync(process.execPath, ["--require", preload, join(__dirname, "pre-push-tests.cjs")], { input: "refs/heads/a abc refs/heads/a def\n", encoding: "utf8" });
			assert.equal(result.status, status, result.stderr);
			assert.match(result.stdout, new RegExp(expected));
			assert.doesNotMatch(result.stdout, /unexpected/);
			if (expected === "native-policy") assert.doesNotMatch(result.stdout, /native-coverage/);
			if (expected === "native-coverage") assert.match(result.stdout, /native-policy[\s\S]*native-coverage/);
			if (paths.startsWith("packages/runner/")) assert.doesNotMatch(result.stdout, /application-coverage|related-tests/);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("test children shed hook-local Git paths while retaining test configuration", () => {
	const source = { GIT_DIR: "/parent/git", GIT_COMMON_DIR: "/parent/common", GIT_WORK_TREE: "/parent/worktree", GIT_INDEX_FILE: "/parent/index", GIT_OBJECT_DIRECTORY: "/parent/objects", GIT_CONFIG_PARAMETERS: "inherited config", PATH: "fixture-path", MCP_TEST_TEMPLATE_ID: "push-fixture", MCP_TEST_DATABASE_URL: "postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture" };
	assert.deepEqual(isolatedTestEnvironment(source), { PATH: source.PATH, MCP_TEST_TEMPLATE_ID: source.MCP_TEST_TEMPLATE_ID, MCP_TEST_DATABASE_URL: source.MCP_TEST_DATABASE_URL });
	assert.equal(source.GIT_DIR, "/parent/git");
});

test("self-tests and coverage receive isolated Git environments without weakening failures", () => {
	const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
	const { tmpdir } = require("node:os");
	const { join } = require("node:path");
	const { spawnSync } = require("node:child_process");
	const directory = mkdtempSync(join(tmpdir(), "clipify-push-git-env-"));
	try {
		const preload = join(directory, "child-boundary.cjs");
		writeFileSync(
			preload,
			`const assert=require('node:assert/strict'),child=require('node:child_process');child.execFileSync=(command,args)=>args.includes('--local-env-vars')?'GIT_DIR\\nGIT_INDEX_FILE\\nGIT_WORK_TREE':'src/auth/mcp-options.ts';child.spawnSync=(command,args,options)=>{for(const name of ['GIT_DIR','GIT_INDEX_FILE','GIT_WORK_TREE'])assert.equal(options.env[name],undefined);assert.equal(options.env.MCP_TEST_TEMPLATE_ID,'push-fixture');assert.equal(process.env.GIT_DIR,'/parent/repository');console.log('isolated-child');return {status:args[0].endsWith('pre-push-tests.test.cjs')?0:1};};`,
		);
		const result = spawnSync(process.execPath, ["--require", preload, join(__dirname, "pre-push-tests.cjs")], { input: "refs/heads/a abc refs/heads/a def\n", encoding: "utf8", env: { ...process.env, GIT_DIR: "/parent/repository", GIT_INDEX_FILE: "/parent/index", GIT_WORK_TREE: "/parent/tree", MCP_TEST_TEMPLATE_ID: "push-fixture" } });
		assert.equal(result.status, 1, result.stderr);
		assert.equal((result.stdout.match(/isolated-child/g) ?? []).length, 2, result.stderr);
		assert.match(result.stdout, /full application coverage owner/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
