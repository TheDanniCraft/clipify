import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("owning coverage lane records changed worktree inputs without requiring a new commit", () => {
	const root = mkdtempSync(join(tmpdir(), "clipify-coverage-source-"));
	const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
	try {
		for (const directory of ["test", "scripts", "node_modules/jest/bin"]) mkdirSync(join(root, directory), { recursive: true });
		writeFileSync(join(root, ".gitignore"), "coverage/\nnode_modules/\n");
		writeFileSync(join(root, "test/unit.test.ts"), "initial fixture\n");
		writeFileSync(join(root, "node_modules/jest/bin/jest.js"), "console.log(JSON.stringify([require('node:path').resolve('test/unit.test.ts')]));");
		// Exercise the real lane producer; the fixture runner only supplies its
		// child execution result. This test makes no product-coverage claim.
		writeFileSync(join(root, "scripts/run-mcp-coverage.mjs"), "import fs from 'node:fs';import path from 'node:path';const output=process.argv.find(a=>a.startsWith('--outputFile=')).slice('--outputFile='.length);fs.writeFileSync(output,JSON.stringify({testResults:[{name:path.resolve('test/unit.test.ts')}]}));if(process.env.CLIPIFY_FINGERPRINT_TEST_MUTATE==='1')fs.appendFileSync('test/unit.test.ts','changed during execution');");
		git("init", "-q");
		git("add", ".");
		git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Add fixture");
		const run = () => {
			execFileSync(process.execPath, [resolve("scripts/run-coverage-lane.mjs"), "unit"], { cwd: root, stdio: "pipe" });
			return JSON.parse(readFileSync(join(root, "coverage/unit/lane.json"), "utf8"));
		};
		const first = run();
		assert.deepEqual(run(), first);
		writeFileSync(join(root, "test/unit.test.ts"), "changed fixture\n");
		const changed = run();
		assert.equal(changed.tree, first.tree);
		assert.notEqual(changed.sourceFingerprint, first.sourceFingerprint);
		assert.match(changed.sourceFingerprint, /^[a-f0-9]{64}$/);
		mkdirSync(join(root, "src"));
		writeFileSync(join(root, "src/new.ts"), "new untracked runtime input");
		assert.notEqual(run().sourceFingerprint, changed.sourceFingerprint);
		unlinkSync(join(root, "src/new.ts"));
		assert.equal(run().sourceFingerprint, changed.sourceFingerprint);
		assert.throws(
			() => execFileSync(process.execPath, [resolve("scripts/run-coverage-lane.mjs"), "unit"], { cwd: root, stdio: "pipe", env: { ...process.env, CLIPIFY_FINGERPRINT_TEST_MUTATE: "1" } }),
			(error) => error.stderr.toString().includes("inputs changed while the lane was running"),
		);
		assert.equal(existsSync(join(root, "coverage/unit/lane.json")), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
