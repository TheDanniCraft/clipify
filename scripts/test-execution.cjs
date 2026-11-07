/* eslint-disable @typescript-eslint/no-require-imports */
const { resolve, relative } = require("node:path");
const durations = require("./test-duration-baseline.json");
const { planTestUnits } = require("./browser-sharding.cjs");
const normalize = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
const quiet = /(runtime-boundaries|database-(abort|deadline)|provider-(abort|concurrency|deadline|queue|unlock)|request-(cancellation|pool-lifecycle)|cimd-deadline|refresh-boundaries|creation-quotas|policy.*serialization|(create|resource|playlist(-add|-item)?)(-delete)?-expiry|auth-performance)\.test\./;
const nativeScenarioPaths = ["mcp-workflows/", "mcp-support/read_authority.feature.spec.js", "mcp-support/mutation_authority.feature.spec.js"];
const nativeScenarioPatterns = nativeScenarioPaths.map((path) => `**/${path}${path.endsWith("/") ? "**" : ""}`);
const isNativeScenarioFile = (path) => nativeScenarioPaths.some((suffix) => path.replaceAll("\\", "/").includes(`/${suffix}`));
const isQuietTest = (path) => quiet.test(normalize(path));
const database = /(?:^|\/)test\/mcp\/(integration|contract|workflows)\/|test\/auth-engine-rewrite\/integration\/(creator-onboarding-trigger|provider-credential-switch)\.test\.|coverage-(collector|parallel|next-entries)\.test\.|test\/server\/runner\/|test\/app\/lib\/runnerScheduler\.test\./;
function estimatedTestWeights(paths, profile = durations) {
	const known = (path) => profile[path] ?? profile[normalize(path).replace(/^\.features-gen\//, "")];
	const samples = paths.map(known).filter((value) => value !== undefined);
	const fallback = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 5;
	return Object.fromEntries(paths.map((path) => [path, known(path) ?? fallback]));
}
function balance(paths, count, profile = durations, budget = Infinity) {
	const weights = estimatedTestWeights(paths, profile);
	const isNew = (path) => profile[path] === undefined && profile[normalize(path).replace(/^\.features-gen\//, "")] === undefined;
	const bins = Array.from({ length: count }, () => ({ weight: 0, paths: [], newTests: 0 }));
	for (const path of [...paths].sort((a, b) => weights[b] - weights[a] || a.localeCompare(b))) {
		const fits = bins.filter((bin) => bin.weight + weights[path] <= budget);
		const bin = (fits.length ? fits : bins).reduce((best, candidate) => (isNew(path) && candidate.newTests !== best.newTests ? (candidate.newTests < best.newTests ? candidate : best) : candidate.weight < best.weight ? candidate : best));
		bin.paths.push(path);
		bin.weight += weights[path];
		bin.newTests += Number(isNew(path));
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
				return balance(files, count, options.profile ?? durations, options.budgets?.[name] ?? Infinity).map((bin, i) => [name === "database" || count > 1 ? `${name}-${i + 1}` : name, bin]);
			})
			.filter(([, files]) => !options.compact || files.length),
	);
}
function planTestFiles(paths, profile = durations, workers = 1) {
	const weights = estimatedTestWeights(paths, profile);
	const isNew = (path) => profile[path] === undefined && profile[normalize(path).replace(/^\.features-gen\//, "")] === undefined;
	return planTestUnits(paths.map((path) => ({ selector: path, testIds: [path], weight: weights[path] / workers, newTests: Number(isNew(path)) }))).map((bin) => bin.testIds.sort());
}
function planApplicationLanes(paths, profile, workers) {
	if (!Number.isInteger(workers) || workers < 1) throw Error("Invalid application worker estimate");
	const groups = [paths.filter((path) => !isQuietTest(path) && !database.test(normalize(path))), paths.filter((path) => !isQuietTest(path) && database.test(normalize(path))), paths.filter(isQuietTest)];
	const concurrency = [workers, Math.min(4, workers), 1];
	const counts = groups.map((files, index) => Math.max(1, planTestFiles(files, profile, concurrency[index]).length));
	return { unitCount: counts[0], databaseCount: counts[1], quietCount: counts[2], profile, compact: true, budgets: { unit: 300 * concurrency[0], database: 300 * concurrency[1], quiet: 300 } };
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
module.exports = { planTestFiles, estimatedTestWeights, partitionTests, planApplicationLanes, coveragePartitions, fullValidationRequired, selectBrowserFiles, balance, isQuietTest, nativeScenarioPatterns, ...require("./browser-sharding.cjs") };
