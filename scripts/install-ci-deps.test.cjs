/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
	assert = require("node:assert/strict");
const fs = require("node:fs"),
	{ join } = require("node:path"),
	{ spawnSync } = require("node:child_process");
test("package commands have noninteractive, network, lock and whole-command bounds and preserve failures", () => {
	const dir = fs.mkdtempSync(join(require("node:os").tmpdir(), "ci-apt-"));
	try {
		const log = join(dir, "log");
		fs.writeFileSync(join(dir, "sudo"), '#!/bin/sh\nexec "$@"\n', { mode: 0o755 });
		fs.writeFileSync(join(dir, "timeout"), '#!/bin/sh\necho "$*" >> "$CALL_LOG"\n[ "$FAIL_MODE" = timeout ] && exit 124\nwhile [ "${1#--}" != "$1" ];do shift;done\nshift\nexec "$@"\n', { mode: 0o755 });
		fs.writeFileSync(join(dir, "apt-get"), '#!/bin/sh\necho "config=$APT_CONFIG" >> "$CALL_LOG"\ncat "$APT_CONFIG" >> "$CALL_LOG"\n[ "$DEBIAN_FRONTEND" = noninteractive ] || exit 9\n[ "$NEEDRESTART_MODE" = a ] || exit 10\n[ "$FAIL_MODE" = install ] && exit 42\nexit 0\n', { mode: 0o755 });
		for (const [mode, status] of [
			["ready", 0],
			["install", 42],
			["timeout", 124],
		]) {
			fs.writeFileSync(log, "");
			const r = spawnSync("bash", ["scripts/install-ci-deps.sh", "apt-get", "update"], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false", PATH: dir + ":" + process.env.PATH, CALL_LOG: log, FAIL_MODE: mode } });
			assert.equal(r.status, status, r.stderr);
			const text = fs.readFileSync(log, "utf8");
			assert.match(text, /--kill-after=15s 180s/);
			if (mode !== "timeout") {
				assert.match(text, /Acquire::https::Timeout "30"/);
				assert.match(text, /DPkg::Lock::Timeout "60"/);
				assert.match(text, /Acquire::Retries "2"/);
				const config = text.match(/config=(.*)/)[1];
				assert.equal(fs.existsSync(config), false);
			}
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
test("frame bootstrap uses the bundled fonts without a package update on prepared runners", () => {
	const dir = fs.mkdtempSync(join(require("node:os").tmpdir(), "frame-bootstrap-"));
	try {
		const log = join(dir, "log"),
			fonts = join(dir, "fonts");
		fs.writeFileSync(join(dir, "sudo"), '#!/bin/sh\necho "$*" >> "$CALL_LOG"\nexec "$@"\n', { mode: 0o755 });
		for (const name of ["ffmpeg", "ffprobe"]) fs.writeFileSync(join(dir, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
		const env = { ...process.env, GITHUB_ACTIONS: "false", PATH: dir + ":" + process.env.PATH, CALL_LOG: log };
		let r = spawnSync("bash", ["scripts/install-frame-deps.sh", fonts], { encoding: "utf8", env });
		assert.equal(r.status, 0, r.stderr);
		assert.deepEqual(fs.readFileSync(join(fonts, "DejaVuSans.ttf")), fs.readFileSync("public/fonts/brand/DejaVuSans.ttf"));
		assert.doesNotMatch(fs.readFileSync(log, "utf8"), /apt-get/);
		fs.writeFileSync(log, "");
		r = spawnSync("bash", ["scripts/install-frame-deps.sh", fonts], { encoding: "utf8", env });
		assert.equal(r.status, 0, r.stderr);
		assert.equal(fs.readFileSync(log, "utf8"), "");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("missing frame binaries install through the bounded package helper", () => {
	const dir = fs.mkdtempSync(join(require("node:os").tmpdir(), "missing-frame-"));
	try {
		const bin = join(dir, "bin"),
			fonts = join(dir, "fonts"),
			log = join(dir, "log");
		fs.mkdirSync(bin);
		fs.mkdirSync(fonts);
		fs.writeFileSync(join(fonts, "DejaVuSans.ttf"), "fixture");
		for (const command of ["bash", "dirname", "mktemp", "cat", "rm", "env", "timeout", "chmod"]) fs.symlinkSync("/usr/bin/" + command, join(bin, command));
		fs.writeFileSync(join(bin, "sudo"), '#!/bin/sh\nexec "$@"\n', { mode: 0o755 });
		fs.writeFileSync(join(bin, "apt-get"), '#!/bin/sh\necho "$*" >> "$CALL_LOG"\nif [ "$1" = install ];then\n for name in ffmpeg ffprobe;do printf "#!/bin/sh\\nexit 0\\n" > "$TEST_BIN/$name";chmod 755 "$TEST_BIN/$name";done\nfi\n', { mode: 0o755 });
		const result = spawnSync("/bin/bash", ["scripts/install-frame-deps.sh", fonts], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false", PATH: bin, CALL_LOG: log, TEST_BIN: bin } });
		assert.equal(result.status, 0, result.stderr);
		const calls = fs.readFileSync(log, "utf8");
		assert.match(calls, /update/);
		assert.match(calls, /install -y --no-install-recommends ffmpeg/);
		assert.equal(fs.existsSync(join(bin, "ffprobe")), true);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("hosted runner setup replaces the stalled Azure Ubuntu mirror before installing", () => {
	const dir = fs.mkdtempSync(join(require("node:os").tmpdir(), "ci-mirror-"));
	try {
		const log = join(dir, "log");
		fs.writeFileSync(join(dir, "sudo"), '#!/bin/sh\necho "$*" >> "$CALL_LOG"\nexit 0\n', { mode: 0o755 });
		const result = spawnSync("bash", ["scripts/install-ci-deps.sh", "apt-get", "update"], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false", PATH: dir + ":" + process.env.PATH, GITHUB_ACTIONS: "true", CALL_LOG: log } });
		assert.equal(result.status, 0, result.stderr);
		const calls = fs.readFileSync(log, "utf8").split("\n");
		assert.ok(calls.some((call) => /sed -i .*https:\/\/archive\.ubuntu\.com.*(?:sources\.list|\.sources|\.list)$/.test(call)));
		assert.match(calls.at(-2), /apt-get update/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("mirror setup includes the mirror-list transport used by hosted Ubuntu runners", () => {
	const script = fs.readFileSync("scripts/install-ci-deps.sh", "utf8");
	assert.match(script, /for source in \/etc\/apt\/apt-mirrors\.txt \/etc\/apt\/apt-mirrors-\*\.txt/);
});

test("runner mirror rewriting uses HTTPS for primary and Azure archive entries", () => {
	const script = fs.readFileSync("scripts/install-ci-deps.sh", "utf8");
	const expression = script.match(/sudo sed -i '([^']+)'/)[1];
	const result = spawnSync("sed", [expression], {
		input: "http://azure.archive.ubuntu.com/ubuntu\nhttps://azure.archive.ubuntu.com/ubuntu\nhttp://archive.ubuntu.com/ubuntu\nhttps://archive.ubuntu.com/ubuntu\nhttps://packages.microsoft.com/ubuntu/26.04/prod\n",
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, "https://archive.ubuntu.com/ubuntu\n".repeat(4) + "https://packages.microsoft.com/ubuntu/26.04/prod\n");
});
