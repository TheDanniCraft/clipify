import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

type PackageJson = {
	patchedDependencies?: Record<string, string>;
};

type LineRange = {
	start: number;
	end: number;
};

type PatchHunk = LineRange & {
	lines: string[];
};

type PatchedFile = {
	file: string;
	ranges: LineRange[];
	hunks: PatchHunk[];
};

type PatchTarget = {
	targetPath: string;
	ranges: LineRange[];
	hunks: PatchHunk[];
};

type RunOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

const packageRoot = resolve(".");
const packageJsonPath = join(packageRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
const patchedDependencies = packageJson.patchedDependencies ?? {};
const projectRequire = createRequire(packageJsonPath);
const typeCheckedExtensions = new Set([".js", ".cjs", ".mjs", ".jsx", ".ts", ".cts", ".mts", ".tsx"]);

let nodeModulesRoot = join(packageRoot, "node_modules");
for (let index = 2; index < process.argv.length; index += 1) {
	const argument = process.argv[index];
	if (argument !== "--node-modules") fail(`Unknown patch validation argument: ${argument}`);
	const value = process.argv[index + 1];
	if (!value) fail("Missing value for --node-modules");
	nodeModulesRoot = resolve(packageRoot, value);
	index += 1;
}

function fail(message: string, details = ""): never {
	const suffix = details.trim() ? `\n${details.trim()}` : "";
	throw new Error(`${message}${suffix}`);
}

function run(command: string, args: string[], options: RunOptions = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? packageRoot,
		encoding: "utf8",
		env: options.env ?? process.env,
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
	};
}

function getPackageDetails(specifier: string) {
	const versionSeparator = specifier.lastIndexOf("@");
	if (versionSeparator <= 0) fail(`Invalid patched dependency specifier: ${specifier}`);

	const packageName = specifier.slice(0, versionSeparator);
	const expectedVersion = specifier.slice(versionSeparator + 1);
	const packageDirectory = join(nodeModulesRoot, ...packageName.split("/"));
	return { packageName, expectedVersion, packageDirectory };
}

function getPatchedFiles(patchSource: string, specifier: string): PatchedFile[] {
	const files = new Map<string, PatchHunk[]>();
	let currentFile: string | undefined;
	let currentHunk: PatchHunk | undefined;
	for (const line of patchSource.split(/\r?\n/u)) {
		if (line.startsWith("+++ b/")) {
			const file = line.slice(6).split("\t", 1)[0];
			if (!file || file === "/dev/null") {
				currentFile = undefined;
				continue;
			}
			if (isAbsolute(file) || file.split(/[\\/]/u).includes("..")) {
				fail(`Unsafe target path in patch for ${specifier}: ${file}`);
			}
			currentFile = file;
			if (!files.has(file)) files.set(file, []);
			currentHunk = undefined;
			continue;
		}

		if (!currentFile) continue;
		if (line.startsWith("@@")) {
			const range = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/u);
			if (!range) fail(`Invalid hunk header in patch for ${specifier}: ${line}`);
			const start = Number(range[1]);
			const count = range[2] === undefined ? 1 : Number(range[2]);
			currentHunk = { start, end: start + Math.max(count - 1, 0), lines: [] };
			files.get(currentFile)?.push(currentHunk);
			continue;
		}

		if (!currentHunk || line.startsWith("\\")) continue;
		if (line.startsWith(" ") || line.startsWith("+")) currentHunk.lines.push(line.slice(1));
	}
	if (files.size === 0) fail(`Patch for ${specifier} does not contain any resulting files`);
	return [...files].map(([file, hunks]) => ({
		file,
		hunks,
		ranges: hunks.map(({ start, end }) => ({ start, end })),
	}));
}

function ensureTargetIsInsidePackage(packageDirectory: string, targetPath: string, specifier: string) {
	const pathFromPackage = relative(packageDirectory, targetPath);
	if (pathFromPackage === ".." || pathFromPackage.startsWith(`..${sep}`) || isAbsolute(pathFromPackage)) {
		fail(`Patch target escapes installed package ${specifier}: ${targetPath}`);
	}
}

function verifyPatchApplied(targets: PatchTarget[], specifier: string) {
	for (const { targetPath, hunks } of targets) {
		const installedLines = readFileSync(targetPath, "utf8").split(/\r?\n/u);
		for (const hunk of hunks) {
			if (hunk.lines.length === 0) continue;
			const found = installedLines.some((_, index) => hunk.lines.every((line, offset) => installedLines[index + offset] === line));
			if (!found) {
				fail(`Installed dependency does not contain a complete patched hunk for ${specifier}`, `${targetPath}:${hunk.start}`);
			}
		}
	}
}

function verifyCodeTargets(targets: PatchTarget[], specifier: string) {
	const codeTargets = targets.filter(({ targetPath }) => {
		const dot = targetPath.lastIndexOf(".");
		return dot >= 0 && typeCheckedExtensions.has(targetPath.slice(dot).toLowerCase());
	});
	if (codeTargets.length === 0) return 0;

	let typescriptPath: string;
	try {
		typescriptPath = projectRequire.resolve("typescript/bin/tsc");
	} catch {
		fail(`TypeScript is required to validate patched code in ${specifier}`);
	}

	for (const { targetPath, ranges } of codeTargets) {
		const result = run(process.execPath, [typescriptPath, "--ignoreConfig", "--allowJs", "--checkJs", "--noEmit", "--skipLibCheck", "--noImplicitAny", "false", "--types", "node", "--module", "node16", "--moduleResolution", "node16", "--target", "es2022", targetPath]);
		if (result.status === 0) continue;

		const diagnostics = [...result.output.matchAll(/\((\d+),\d+\):\s+error\s+TS\d+:/gu)];
		const patchDiagnostics = diagnostics.filter((diagnostic) => {
			const line = Number(diagnostic[1]);
			return ranges.some((range) => line >= range.start && line <= range.end);
		});
		if (diagnostics.length === 0 || patchDiagnostics.length > 0) {
			fail(`TypeScript validation failed inside patched code in ${specifier}`, result.output);
		}
	}
	return codeTargets.length;
}

let patchedFileCount = 0;
let typeCheckedFileCount = 0;

for (const [specifier, patchFile] of Object.entries(patchedDependencies)) {
	const { packageName, expectedVersion, packageDirectory } = getPackageDetails(specifier);
	const patchPath = resolve(packageRoot, patchFile);
	if (!existsSync(patchPath)) fail(`Missing patch for ${specifier}: ${patchFile}`);

	const installedPackageJson = join(packageDirectory, "package.json");
	if (!existsSync(installedPackageJson)) fail(`Patched dependency is not installed: ${packageName}`);

	const installedPackage = JSON.parse(readFileSync(installedPackageJson, "utf8")) as { version?: string };
	if (installedPackage.version !== expectedVersion) {
		fail(`Patch version mismatch for ${packageName}: patch targets ${expectedVersion}, installed ${installedPackage.version ?? "unknown"}`);
	}

	const patchSource = readFileSync(patchPath, "utf8");
	const patchedFiles = getPatchedFiles(patchSource, specifier);
	const targets = patchedFiles.map(({ file, ranges, hunks }) => ({ targetPath: resolve(packageDirectory, file), ranges, hunks }));
	for (const { targetPath } of targets) {
		ensureTargetIsInsidePackage(packageDirectory, targetPath, specifier);
		if (!existsSync(targetPath)) fail(`Patched target is missing for ${specifier}: ${targetPath}`);
	}

	verifyPatchApplied(targets, specifier);
	patchedFileCount += targets.length;
	typeCheckedFileCount += verifyCodeTargets(targets, specifier);
}

console.log(`Verified ${Object.keys(patchedDependencies).length} patched dependencies, ${patchedFileCount} patched files, and ${typeCheckedFileCount} type-checked files in ${nodeModulesRoot}`);
