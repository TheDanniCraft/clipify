const supportedExtensions = new Set([".cjs", ".css", ".js", ".jsx", ".json", ".md", ".mjs", ".ts", ".tsx", ".yaml", ".yml"]);

function gitFiles(args) {
	const result = Bun.spawnSync(["git", ...args], {
		stdout: "pipe",
		stderr: "inherit",
	});

	if (result.exitCode !== 0) process.exit(result.exitCode);

	return result.stdout.toString().split("\0").filter(Boolean);
}

function isSupported(path) {
	const dot = path.lastIndexOf(".");
	return dot >= 0 && supportedExtensions.has(path.slice(dot).toLowerCase());
}

function filesToCheck() {
	const explicitFiles = Bun.argv.slice(2);
	if (explicitFiles.length > 0) return explicitFiles;

	if (process.env.CI) {
		const base = process.env.PRETTIER_BASE_SHA || "HEAD^";
		return gitFiles(["diff", "--name-only", "--diff-filter=ACMRT", "-z", base, "HEAD"]);
	}

	return [...gitFiles(["diff", "--name-only", "--diff-filter=ACMRT", "-z", "HEAD"]), ...gitFiles(["ls-files", "--others", "--exclude-standard", "-z"])];
}

const files = [...new Set(filesToCheck().filter(isSupported))].sort();

if (files.length === 0) {
	console.log("No changed Prettier-supported files to check.");
	process.exit(0);
}

console.log(`Checking ${files.length} changed file${files.length === 1 ? "" : "s"} with Prettier.`);
const prettier = Bun.spawnSync(["bunx", "prettier", "--check", "--", ...files], {
	stdout: "inherit",
	stderr: "inherit",
});

process.exit(prettier.exitCode);
