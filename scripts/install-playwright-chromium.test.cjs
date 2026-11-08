/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
	assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs"),
	{ join } = require("node:path"),
	{ tmpdir } = require("node:os"),
	{ spawnSync } = require("node:child_process");
for (const mode of ["ready", "missing", "failed"])
	test(`Chromium bootstrap checks an actual launch and handles ${mode} libraries`, () => {
		const directory = mkdtempSync(join(tmpdir(), "chromium-bootstrap-"));
		try {
			const log = join(directory, "calls"),
				installed = join(directory, "installed");
			writeFileSync(join(directory, "sudo"), '#!/bin/sh\nexec "$@"\n', { mode: 0o755 });
			writeFileSync(join(directory, "node"), '#!/bin/bash\necho "$*" >> "$CALL_LOG"\nif [[ "$*" == *"install-deps chromium"* ]];then [[ "$MODE" == failed ]] && exit 2; touch "$INSTALLED";fi\nif [[ "$1" == -e && "$MODE" != ready && ! -f "$INSTALLED" ]];then exit 1;fi\nexit 0\n', { mode: 0o755 });
			const result = spawnSync("bash", ["scripts/install-playwright-chromium.sh"], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false", PATH: directory + ":" + process.env.PATH, MODE: mode, INSTALLED: installed, CALL_LOG: log } });
			const calls = readFileSync(log, "utf8");
			assert.match(calls, /install chromium/);
			assert.match(calls, /chromium.launch/);
			assert.doesNotMatch(calls, /--dry-run/);
			if (mode === "ready") assert.doesNotMatch(calls, /install-deps/);
			else assert.match(calls, /install-deps chromium/);
			assert.equal(result.status, mode === "failed" ? 2 : 0, result.stderr);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
