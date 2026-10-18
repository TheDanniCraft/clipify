/** @jest-environment node */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test.each([
	{ name: "resolves matching nested version beside another direct version", extraCopy: false, missingVersion: false, status: 0 },
	{ name: "validates every matching installed copy", extraCopy: true, missingVersion: false, status: 1 },
	{ name: "rejects a missing exact version", extraCopy: false, missingVersion: true, status: 1 },
])("DEF-US1-032: $name", ({ extraCopy, missingVersion, status }) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-patch-resolution-"));
	try {
		const direct = join(directory, "node_modules/fixture-dependency"),
			nested = join(directory, "node_modules/consumer/node_modules/fixture-dependency");
		mkdirSync(direct, { recursive: true });
		mkdirSync(nested, { recursive: true });
		writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true, patchedDependencies: { "fixture-dependency@2.0.0": "fixture.patch" } }));
		writeFileSync(join(direct, "package.json"), JSON.stringify({ name: "fixture-dependency", version: "1.0.0" }));
		writeFileSync(join(directory, "node_modules/consumer/package.json"), JSON.stringify({ name: "consumer", version: "1.0.0" }));
		writeFileSync(join(nested, "package.json"), JSON.stringify({ name: "fixture-dependency", version: missingVersion ? "3.0.0" : "2.0.0" }));
		writeFileSync(join(nested, "README.md"), "patched\n");
		writeFileSync(join(directory, "fixture.patch"), "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-original\n+patched\n");
		if (extraCopy) {
			const extra = join(directory, "node_modules/other-consumer/node_modules/fixture-dependency");
			mkdirSync(extra, { recursive: true });
			writeFileSync(join(directory, "node_modules/other-consumer/package.json"), JSON.stringify({ name: "other-consumer", version: "1.0.0" }));
			writeFileSync(join(extra, "package.json"), JSON.stringify({ name: "fixture-dependency", version: "2.0.0" }));
		}
		const run = spawnSync("bun", [resolve("scripts/validate-patched-dependencies.ts")], { cwd: directory, encoding: "utf8", timeout: 10000 });
		expect({ status: run.status, output: run.stdout + run.stderr }).toMatchObject({ status });
		if (status === 0) expect(run.stdout).toContain("1 patched files");
		else expect(run.stderr).toContain(extraCopy ? "Patched target is missing" : "Patched dependency version is not installed");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
