import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const base = process.argv[2];
if (!base) throw new Error("A verified comparison commit is required");
const comparison = base === "--paths" ? undefined : execFileSync("git", ["merge-base", base, "HEAD"], { encoding: "utf8" }).trim();
const paths = base === "--paths" ? JSON.parse(process.argv[3]) : [...new Set([...execFileSync("git", ["diff", "--name-only", "--no-renames", comparison], { encoding: "utf8" }).split("\n"), ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n")].filter(Boolean))];
if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string")) throw new Error("Invalid changed-path inventory");
const code = paths.filter((path) => !/\.(md|txt)$/.test(path) && !path.startsWith("graphify-out/"));
const run = (args) => {
	const result = spawnSync(process.execPath, args, { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error("Scoped validation failed");
};
if (code.some((path) => path.startsWith("scripts/") || path.startsWith(".github/"))) {
	const tests = readdirSync("scripts")
		.filter((path) => /\.test\.(cjs|mjs)$/.test(path))
		.map((path) => `scripts/${path}`);
	run(["--test", ...tests]);
}
if (code.some((path) => /\.feature$|playwright|test\/bdd\/|test\/atdd\//.test(path))) {
	run(["node_modules/playwright-bdd/dist/cli/index.js"]);
	run(["scripts/check-generated-scenarios.mjs"]);
}
const related = code.filter((path) => /\.[cm]?[jt]sx?$/.test(path) && existsSync(path) && !path.startsWith("scripts/"));
if (code.some((path) => /(?:mcp-(?:test-runner|fixture)|coverage|test-(?:execution|lane|duration))/.test(path))) {
	run(["node_modules/jest/bin/jest.js", "--runInBand", "test/mcp/unit/test-runner-lanes.test.ts", "test/mcp/unit/test-runner-database-budget.test.ts", "test/mcp/unit/coverage-parallel.test.ts", "test/mcp/integration/fixture-template.test.ts", "test/mcp/integration/notification-outbox-failures.test.ts"]);
}
if (related.length) {
	const listArgs = ["node_modules/jest/bin/jest.js", "--findRelatedTests", ...related];
	const selected = JSON.parse(execFileSync(process.execPath, [...listArgs, "--listTests", "--json"], { encoding: "utf8" }));
	if (!selected.length && related.some((path) => path.startsWith("src/"))) throw new Error("Changed application code has no related tests; full validation is required");
	if (selected.length) run(listArgs);
}
console.log("Scoped feedback complete. Full merge validation remains required.");
