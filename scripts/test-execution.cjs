/* eslint-disable @typescript-eslint/no-require-imports */
const { resolve, relative } = require("node:path");
const durations = require("./test-duration-baseline.json");
const normalize = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
const quiet = /(runtime-boundaries|database-(abort|deadline)|provider-(abort|concurrency|deadline|queue|unlock)|request-(cancellation|pool-lifecycle)|cimd-deadline|refresh-boundaries|creation-quotas|policy.*serialization|(create|resource|playlist(-add|-item)?)(-delete)?-expiry|auth-performance)\.test\./;
const nativeScenarioPaths = ["mcp-workflows/", "mcp-support/read_authority.feature.spec.js", "mcp-support/mutation_authority.feature.spec.js"];
const nativeScenarioPatterns = nativeScenarioPaths.map((path) => `**/${path}${path.endsWith("/") ? "**" : ""}`);
const isNativeScenarioFile = (path) => nativeScenarioPaths.some((suffix) => path.replaceAll("\\", "/").includes(`/${suffix}`));
const isQuietTest = (path) => quiet.test(normalize(path));
const database = /(?:^|\/)test\/mcp\/(integration|contract|workflows)\/|test\/auth-engine-rewrite\/integration\/(creator-onboarding-trigger|provider-credential-switch)\.test\.|coverage-(collector|parallel|next-entries)\.test\.|test\/server\/runner\/|test\/app\/lib\/runnerScheduler\.test\./;
function balance(paths, count) {
	const bins = Array.from({ length: count }, () => ({ weight: 0, paths: [] }));
	const weight = (path) => durations[normalize(path).replace(/^\.features-gen\//, "")] ?? 1;
	for (const path of [...paths].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
		const bin = bins.reduce((best, candidate) => (candidate.weight < best.weight ? candidate : best));
		bin.paths.push(path);
		bin.weight += weight(path);
	}
	return bins.map((bin) => bin.paths.sort());
}
function partitionTests(paths) {
	const timing = paths.filter((path) => isQuietTest(path));
	const ordinary = paths.filter((path) => !isQuietTest(path));
	const db = balance(
		ordinary.filter((path) => database.test(normalize(path))),
		3,
	);
	return { unit: ordinary.filter((path) => !database.test(normalize(path))).sort(), "database-1": db[0], "database-2": db[1], "database-3": db[2], quiet: timing.sort() };
}
function fullValidationRequired(event, eventName) {
	return !(eventName === "pull_request" && event.pull_request?.draft === true);
}
function selectBrowserFiles(paths, index, count) {
	if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) throw new Error("Invalid browser shard");
	return balance(
		paths.filter((path) => !isNativeScenarioFile(path)),
		count,
	)[index];
}
module.exports = { partitionTests, fullValidationRequired, selectBrowserFiles, balance, isQuietTest, nativeScenarioPatterns, ...require("./browser-sharding.cjs") };
