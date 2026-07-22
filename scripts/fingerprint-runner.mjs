import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["packages/runner", "scripts/fingerprint-runner.mjs", "scripts/run-runner-self-test.mjs", "scripts/write-runner-metadata.mjs", "scripts/validate-runner-matrix.mjs", ".github/workflows/runner-native.yml"];
const git = (args) => execFileSync("git", args, { encoding: "buffer" });
const gitCommit = () => {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	} catch {
		return process.env.RUNNER_SOURCE_COMMIT || "unknown";
	}
};
const commit = gitCommit();
const files = new Set();
const collectFiles = (root) => {
	if (!existsSync(root)) return;
	const visit = (file) => {
		const relativeFile = relative(process.cwd(), file).replaceAll("\\", "/");
		const stat = statSync(file);
		if (stat.isDirectory()) {
			if ([".git", "node_modules", "build", ".next"].includes(relativeFile.split("/").at(-1))) return;
			for (const entry of readdirSync(file)) visit(join(file, entry));
			return;
		}
		files.add(relativeFile);
	};
	visit(root);
};
for (const root of roots) {
	try {
		const output = git(["ls-files", "-z", "--", root]).toString("utf8");
		const tracked = output.split("\0").filter(Boolean);
		if (tracked.length) {
			for (const file of tracked) files.add(file);
			continue;
		}
	} catch {
		// Docker build contexts do not contain Git metadata.
	}
	collectFiles(root);
}
const hash = createHash("sha256");
const sortedFiles = [...files].sort();
for (const file of sortedFiles) {
	let content;
	try {
		content = git(["show", `${commit}:${file}`]);
	} catch {
		content = readFileSync(file);
	}
	hash.update(`file\0${file}\0${content.length}\0`);
	hash.update(content);
}
const result = { sourceFingerprint: hash.digest("hex"), sourceCommit: commit, files: sortedFiles };
if (process.argv.includes("--fingerprint")) console.log(result.sourceFingerprint);
else if (process.argv.includes("--commit")) console.log(result.sourceCommit);
else if (process.argv.includes("--write-context")) {
	const output = process.argv[process.argv.indexOf("--write-context") + 1];
	if (!output) throw new Error("Missing output path for --write-context");
	writeFileSync(output, `export const RUNNER_CONTEXT = ${JSON.stringify({ sourceFingerprint: result.sourceFingerprint, sourceCommit: result.sourceCommit })} as const;\n`);
} else console.log(JSON.stringify(result, null, 2));
