/* eslint-disable @typescript-eslint/no-require-imports */
const { globSync, readFileSync } = require("node:fs"),
	{ resolve, relative } = require("node:path"),
	{ createHash } = require("node:crypto");
const { balance, readTestDurations } = require("./test-execution.cjs");
const directory = resolve(__dirname, "../packages/runner");
const normalize = (path) => relative(directory, resolve(directory, path)).replaceAll("\\", "/");
function runnerTestInventory() {
	const config = require("../packages/runner/jest.config.cjs");
	return [
		...new Set(
			globSync(
				config.testMatch.map((p) => p.replace("<rootDir>/", "")),
				{ cwd: directory },
			),
		),
	]
		.map(normalize)
		.sort();
}
function partitionRunnerTests(paths, count, weights = readTestDurations()) {
	return balance(
		paths.map((p) => "packages/runner/" + normalize(p)),
		count,
		weights,
	).map((bin) => bin.map((p) => p.replace(/^packages\/runner\//, "")));
}
function planRunnerShards(paths = runnerTestInventory(), weights = readTestDurations()) {
	if (!paths.length) throw Error("Empty Runner inventory");
	const seconds = paths.reduce((n, p) => n + (weights["packages/runner/" + normalize(p)] ?? 1), 0);
	return partitionRunnerTests(paths, Math.min(paths.length, Math.max(1, Math.ceil(seconds / 300))), weights);
}
const fileHash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
module.exports = { runnerTestInventory, partitionRunnerTests, planRunnerShards, normalize, fileHash, directory };
