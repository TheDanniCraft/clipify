/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

let fixture: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: fixture, stdio: "pipe" });
const fingerprint = () => JSON.parse(execFileSync(process.execPath, ["scripts/fingerprint-runner.mjs"], { cwd: fixture, encoding: "utf8", env: { ...process.env, RUNNER_EXECUTION_PUBLIC_KEYS: "{}" } })) as { sourceFingerprint: string; sourceCommit: string; files: string[] };
beforeEach(() => {
	fixture = mkdtempSync(join(tmpdir(), "clipify-runner-fingerprint-"));
	mkdirSync(join(fixture, "scripts"));
	mkdirSync(join(fixture, "packages/runner/src"), { recursive: true });
	copyFileSync(resolve("scripts/fingerprint-runner.mjs"), join(fixture, "scripts/fingerprint-runner.mjs"));
	writeFileSync(join(fixture, "packages/runner/src/index.ts"), "export const version = 1;\n");
	writeFileSync(join(fixture, ".gitignore"), "packages/runner/build/\npackages/runner/coverage/\n");
	git("init", "-q");
	git("add", ".");
	git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Fixture");
});
afterEach(() => rmSync(fixture, { recursive: true, force: true }));

test("F1 native artifact identity changes for modified tracked source while retaining its base commit", () => {
	const before = fingerprint();
	writeFileSync(join(fixture, "packages/runner/src/index.ts"), "export const version = 2;\n");
	const after = fingerprint();
	expect(after.sourceCommit).toBe(before.sourceCommit);
	expect(after.sourceFingerprint).not.toBe(before.sourceFingerprint);
	git("add", ".");
	expect(fingerprint().sourceFingerprint).toBe(after.sourceFingerprint);
});
test("F1 native artifact identity includes new untracked execution modules", () => {
	const before = fingerprint();
	writeFileSync(join(fixture, "packages/runner/src/execution.ts"), "export const safe = true;\n");
	const after = fingerprint();
	expect(after.files).toContain("packages/runner/src/execution.ts");
	expect(after.sourceFingerprint).not.toBe(before.sourceFingerprint);
});
test("F1 native artifact identity excludes removed tracked source", () => {
	const before = fingerprint();
	unlinkSync(join(fixture, "packages/runner/src/index.ts"));
	const after = fingerprint();
	expect(after.files).not.toContain("packages/runner/src/index.ts");
	expect(after.sourceFingerprint).not.toBe(before.sourceFingerprint);
});
test("F1 native artifact identity ignores generated output and unrelated application changes", () => {
	const before = fingerprint();
	mkdirSync(join(fixture, "packages/runner/build"));
	mkdirSync(join(fixture, "packages/runner/coverage"));
	writeFileSync(join(fixture, "packages/runner/build/binary"), "binary");
	writeFileSync(join(fixture, "packages/runner/coverage/report.json"), "{}");
	mkdirSync(join(fixture, "src"));
	writeFileSync(join(fixture, "src/app.ts"), "unrelated");
	expect(fingerprint()).toEqual(before);
});
