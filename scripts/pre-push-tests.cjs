/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync, spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

const hookFiles = new Set([".husky/pre-push", "scripts/pre-push-tests.cjs", "scripts/pre-push-tests.test.cjs"]);

function selectPushChecks(paths, environment = process.env) {
	const migrationAutomation = environment.GITHUB_ACTIONS === "true" && environment.GITHUB_REF === "refs/heads/master" && environment.GITHUB_WORKFLOW === "🗃️ Generate Migrations" && environment.CLIPIFY_MIGRATION_WORKFLOW === "true";
	const generatedMigration = /^drizzle\/(?:\d{4}_[^/]+\.sql|meta\/(?:\d{4}_snapshot|_journal)\.json)$/;
	// Generation and the commit migration guard own these artifacts; this job has no application test database.

	const documentation = /(^|\/)(?:[^/]+\.md|[^/]+\.txt)$|^graphify-out\//;
	const broad = /^(?:package\.json|bun\.lockb?|(?:jest|next|tsconfig|drizzle)\.|\.husky\/|\.github\/|scripts\/|test\/support\/|test\/__mocks__\/|drizzle\/|src\/db\/|src\/auth\/|src\/server\/mcp\/)/;
	const relevant = [...new Set(paths.filter((path) => !documentation.test(path) && !hookFiles.has(path) && !(migrationAutomation && generatedMigration.test(path))))];
	if (!relevant.length) return { full: false, paths: [] };
	if (relevant.some((path) => broad.test(path) || !(/\.[cm]?[jt]sx?$/.test(path) || /^test\/(bdd|atdd)\/.*\.feature$/.test(path)))) return { full: true, paths: [] };
	return { full: false, paths: relevant };
}

function changedPaths(input, git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()) {
	const paths = new Set();
	const updates = input.trim().split("\n").filter(Boolean);
	if (!updates.length) throw new Error("Missing push ref updates");
	for (const line of updates) {
		const fields = line.trim().split(/\s+/);
		if (fields.length !== 4) throw new Error("Invalid push ref update");
		const [, local, , remote] = fields;
		if (/^0+$/.test(local)) continue;
		const base = /^0+$/.test(remote) ? git("merge-base", local, "origin/master") : remote;
		for (const path of git("diff", "--name-only", "--no-renames", base, local, "--").split("\n").filter(Boolean)) paths.add(path);
	}
	return [...paths];
}

function main() {
	// Child test runners may drain inherited stdin. Preserve Git's refs first.
	let refInput = "";
	try {
		refInput = readFileSync(0, "utf8");
	} catch {
		// Invalid/missing input retains the conservative full-suite fallback.
	}
	const selfTest = spawnSync(process.execPath, [require("node:path").join(__dirname, "pre-push-tests.test.cjs")], { stdio: "inherit" });
	if (selfTest.status !== 0) {
		process.exitCode = selfTest.status ?? 1;
		return;
	}
	let check;
	try {
		check = selectPushChecks(changedPaths(refInput));
	} catch {
		console.log("[pre-push] Cannot determine changed files; running the full suite.");
		check = { full: true, paths: [] };
	}
	if (!check.full && !check.paths.length) {
		console.log("[pre-push] No application files changed; hook checks passed. Full application checks run in CI.");
		return;
	}
	console.log(check.full ? "[pre-push] Shared infrastructure changed; running the full suite." : `[pre-push] Running tests related to ${check.paths.length} changed files. Full checks remain in CI.`);
	const args = ["run", "test", ...(check.full ? [] : ["--findRelatedTests", ...check.paths, "--passWithNoTests"])];
	const result = spawnSync("bun", args, { stdio: "inherit" });
	if (result.error) console.error(result.error.message);
	process.exitCode = result.status ?? 1;
}

module.exports = { selectPushChecks, changedPaths };
if (require.main === module) main();
