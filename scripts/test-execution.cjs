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
function balance(paths, count, profile = durations) {
	const bins = Array.from({ length: count }, () => ({ weight: 0, paths: [] }));
	const weight = (path) => profile[path] ?? profile[normalize(path).replace(/^\.features-gen\//, "")] ?? 1;
	for (const path of [...paths].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
		const bin = bins.reduce((best, candidate) => (candidate.weight < best.weight ? candidate : best));
		bin.paths.push(path);
		bin.weight += weight(path);
	}
	return bins.map((bin) => bin.paths.sort());
}
function partitionTests(paths, options = {}) {
	const timing = paths.filter(isQuietTest),
		ordinary = paths.filter((path) => !isQuietTest(path));
	const groups = [
		["unit", ordinary.filter((path) => !database.test(normalize(path))), options.unitCount ?? 1],
		["database", ordinary.filter((path) => database.test(normalize(path))), options.databaseCount ?? 3],
		["quiet", timing, options.quietCount ?? 1],
	];
	return Object.fromEntries(
		groups
			.flatMap(([name, files, count]) => {
				if (!Number.isInteger(count) || count < 1) throw new Error("Invalid application shard count");
				return balance(files, count, options.profile ?? durations).map((bin, i) => [name === "database" || count > 1 ? `${name}-${i + 1}` : name, bin]);
			})
			.filter(([, files]) => !options.compact || files.length),
	);
}
function planApplicationLanes(paths, profile, workers) {
	if (!Number.isInteger(workers) || workers < 1) throw new Error("Invalid application worker estimate");
	const groups = [paths.filter((path) => !isQuietTest(path) && !database.test(normalize(path))), paths.filter((path) => !isQuietTest(path) && database.test(normalize(path))), paths.filter(isQuietTest)];
	const counts = groups.map((files, index) => Math.min(Math.max(1, files.length), Math.max(1, Math.ceil(files.reduce((n, path) => n + (profile[path] ?? profile[normalize(path)] ?? 1), 0) / (300 * (index === 2 ? 1 : Math.min(index === 1 ? 4 : workers, workers)))))));
	return { unitCount: counts[0], databaseCount: counts[1], quietCount: counts[2], profile, compact: true };
}
function coveragePartitions(paths) {
	const path = process.env.CLIPIFY_WORKFLOW_SHARD_PLAN;
	return partitionTests(paths, path ? (JSON.parse(require("node:fs").readFileSync(path, "utf8")).application ?? {}) : {});
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
module.exports = { partitionTests, planApplicationLanes, coveragePartitions, fullValidationRequired, selectBrowserFiles, balance, isQuietTest, nativeScenarioPatterns, ...require("./browser-sharding.cjs") };
