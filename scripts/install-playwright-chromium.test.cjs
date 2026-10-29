/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawnSync } = require("node:child_process");

for (const mode of ["ready", "missing", "failed"])
	test(`Chromium preparation verifies OS libraries and handles ${mode} dependencies`, () => {
		const directory = mkdtempSync(join(tmpdir(), "playwright-deps-"));
		try {
			writeFileSync(join(directory, "node"), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$CLIPIFY_BROWSER_DEPS_LOG"\nif [[ "$*" == *"--dry-run"* && "$CLIPIFY_BROWSER_DEPS_MODE" != ready ]]; then exit 1; fi\nif [[ "$*" == *"install-deps chromium" && "$CLIPIFY_BROWSER_DEPS_MODE" == failed ]]; then exit 2; fi\n', { mode: 0o755 });
			const log = join(directory, "calls");
			const result = spawnSync("bash", ["scripts/install-playwright-chromium.sh"], { env: { ...process.env, PATH: directory + ":" + process.env.PATH, CLIPIFY_BROWSER_DEPS_LOG: log, CLIPIFY_BROWSER_DEPS_MODE: mode }, encoding: "utf8" });
			const calls = readFileSync(log, "utf8")
				.trim()
				.split("\n")
				.map((line) => line.replace("node_modules/@playwright/test/cli.js ", ""));
			assert.deepEqual(calls, ["install-deps --dry-run chromium", ...(mode !== "ready" ? ["install-deps chromium"] : []), ...(mode !== "failed" ? ["install chromium"] : [])]);
			assert.equal(result.status, mode === "failed" ? 2 : 0);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
