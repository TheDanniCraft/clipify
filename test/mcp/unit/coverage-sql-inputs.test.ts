/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("coverage identity changes when a database fixture's SQL migration changes", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-sql-input-"));
	try {
		execFileSync("git", ["init", "--quiet", directory]);
		mkdirSync(join(directory, "drizzle"));
		const sql = join(directory, "drizzle", "0026_notification_event_triggers.sql");
		writeFileSync(sql, "SELECT 'original trigger';\n");
		const moduleUrl = pathToFileURL(resolve("scripts/coverage-source-fingerprint.mjs")).href;
		const fingerprint = () => execFileSync(process.execPath, ["--input-type=module", "-e", `import { coverageSourceFingerprint } from ${JSON.stringify(moduleUrl)}; process.stdout.write(coverageSourceFingerprint());`], { cwd: directory, encoding: "utf8" });
		const original = fingerprint();
		writeFileSync(sql, "SELECT 'changed trigger';\n");
		expect(fingerprint()).not.toBe(original);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
