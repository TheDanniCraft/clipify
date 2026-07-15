import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const roots = [
  "src/runner", "scripts/build-runner.ts", "scripts/fingerprint-runner.mjs",
  "scripts/check-runner-native.mjs", "scripts/run-runner-self-test.mjs",
  "scripts/write-runner-metadata.mjs", "scripts/validate-runner-matrix.mjs", "runner-build-config.json", "package.json",
  "bun.lock", "patches/yao-pkg-qemu.patch", ".github/workflows/runner-native.yml",
];
const git = (args) => execFileSync("git", args, { encoding: "buffer" });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const files = new Set();
for (const root of roots) {
  const output = git(["ls-files", "-z", "--", root]).toString("utf8");
  for (const file of output.split("\0")) if (file) files.add(file);
}
const hash = createHash("sha256");
const sortedFiles = [...files].sort();
for (const file of sortedFiles) {
  const content = git(["show", `${commit}:${file}`]);
  hash.update(`file\0${file}\0${content.length}\0`);
  hash.update(content);
}
const result = { sourceFingerprint: hash.digest("hex"), sourceCommit: commit, files: sortedFiles };
if (process.argv.includes("--fingerprint")) console.log(result.sourceFingerprint);
else if (process.argv.includes("--commit")) console.log(result.sourceCommit);
else console.log(JSON.stringify(result, null, 2));
