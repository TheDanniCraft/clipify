import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { searchArguments } from "../src/cli.mjs";

test("search accepts a title and bounded result limit", () => {
	assert.deepEqual(searchArguments(["search", "--title", "Minecraft", "--limit", "100"]), { title: "Minecraft", limit: 100 });
	assert.deepEqual(searchArguments(["search"]), {});
	assert.deepEqual(searchArguments(["search", "--limit", "1"]), { limit: 1 });
});
for (const args of [[], ["unknown"], ["search", "--title"], ["search", "--limit", "0"], ["search", "--limit", "101"], ["search", "--limit", "NaN"], ["search", "--title", "x".repeat(201)], ["search", "--limit", "1", "--limit", "2"], ["search", "--creator", "foreign"]]) {
	test(`reject invalid arguments ${JSON.stringify(args).slice(0, 65)}`, () => assert.throws(() => searchArguments(args), /INVALID_ARGUMENTS/));
}
test("missing setup returns a typed failure without echoing environment secrets", () => {
	const result = spawnSync(process.execPath, ["src/cli.mjs", "search"], { cwd: new URL("..", import.meta.url), env: { PATH: process.env.PATH, CLIPIFY_CLIENT_SECRET: "must-never-appear" }, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.equal(result.stdout, "");
	assert.deepEqual(JSON.parse(result.stderr), { ok: false, error: { code: "MISSING_CONFIGURATION" } });
	assert.equal(result.stderr.includes("must-never-appear"), false);
});

test("secret-file failures never reveal paths or contents and leave private file permissions intact", async () => {
	const { mkdtemp, writeFile, stat, readFile, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const dir = await mkdtemp(join(tmpdir(), "awards-cli-private-"));
	try {
		const clientId = join(dir, "private-client-id"),
			clientSecret = join(dir, "private-client-secret"),
			password = join(dir, "private-database-password");
		for (const [path, value] of [
			[clientId, "private-client-identity"],
			[clientSecret, "MUST_NOT_LEAK_CLIENT_SECRET"],
			[password, "MUST_NOT_LEAK_DB_PASSWORD"],
		])
			await writeFile(path, value, { mode: 0o400 });
		const env = { PATH: process.env.PATH, CLIPIFY_BASE_URL: "https://clipify.example", CLIPIFY_CREATOR_ID: "creator", CLIPIFY_CLIENT_ID_FILE: clientId, CLIPIFY_CLIENT_SECRET_FILE: clientSecret, AWARDS_DATABASE_PASSWORD_FILE: password };
		for (const overrides of [{ CLIPIFY_CLIENT_SECRET_FILE: join(dir, "missing-private-secret") }, { CLIPIFY_BASE_URL: "http://public.example" }]) {
			const result = spawnSync(process.execPath, ["src/cli.mjs", "search"], { cwd: new URL("..", import.meta.url), env: { ...env, ...overrides }, encoding: "utf8" });
			assert.equal(result.status, 1);
			assert.equal(result.stdout, "");
			assert.ok(["MISSING_CONFIGURATION", "INVALID_CONFIGURATION"].includes(JSON.parse(result.stderr).error.code));
			for (const secret of [dir, "MUST_NOT_LEAK_CLIENT_SECRET", "MUST_NOT_LEAK_DB_PASSWORD"]) assert.equal(result.stderr.includes(secret), false);
		}
		assert.equal((await stat(clientSecret)).mode & 0o777, 0o400);
		assert.equal(await readFile(clientSecret, "utf8"), "MUST_NOT_LEAK_CLIENT_SECRET");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
