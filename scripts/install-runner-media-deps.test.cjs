/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
	assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } = require("node:fs"),
	{ join, resolve } = require("node:path"),
	{ spawnSync } = require("node:child_process");
test("prepared runners avoid apt while missing declared media dependencies are installed", () => {
	const dir = mkdtempSync(join(require("node:os").tmpdir(), "clipify-media-deps-"));
	try {
		const bin = join(dir, "bin"),
			chrome = join(dir, "chrome space"),
			log = join(dir, "install.log");
		mkdirSync(bin);
		mkdirSync(chrome);
		writeFileSync(join(chrome, "deb.deps"), "libnss3 (>= 2:3.26)\nlibgbm1\n");
		const executable = (name, body) => writeFileSync(join(bin, name), "#!/bin/sh\n" + body, { mode: 0o755 });
		executable("dpkg-checkbuilddeps", 'case "$*" in *ffmpeg,libnss3*libgbm1*) exit "$MISSING_DEPS";; *) exit 2;; esac\n');
		executable("sudo", 'printf "%s\\n" "$*" >> "$INSTALL_LOG"\n');
		executable("ffmpeg", 'echo "ffmpeg verified"\n');
		for (const missing of ["0", "1"]) {
			const result = spawnSync("bash", [resolve("scripts/install-runner-media-deps.sh")], { encoding: "utf8", env: { ...process.env, PATH: bin + ":" + process.env.PATH, RUNNER_CHROME_PATH: join(chrome, "chrome"), MISSING_DEPS: missing, INSTALL_LOG: log } });
			assert.equal(result.status, 0, result.stderr);
			assert.match(result.stdout, /ffmpeg verified/);
			if (missing === "0") assert.equal(existsSync(log), false);
			else {
				const calls = readFileSync(log, "utf8");
				assert.match(calls, /apt-get update/);
				assert.match(calls, /apt-get install.*ffmpeg/);
				assert.match(calls, /apt-get satisfy.*libnss3.*libgbm1/);
			}
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
