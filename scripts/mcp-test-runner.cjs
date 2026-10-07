/* eslint-disable @typescript-eslint/no-require-imports */
const DefaultRunner = require("jest-runner").default;
const { mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { readTestSystem, selectTestWorkers } = require("./test-worker-budget.cjs");
const { selectDatabaseWorkers, readFixtureDatabaseCapacity } = require("./test-database-budget.cjs");

function isQuietTest(path) {
	return /(runtime-boundaries|database-(abort|deadline)|provider-(abort|concurrency|deadline|queue|unlock)|request-(cancellation|pool-lifecycle)|cimd-deadline|refresh-boundaries|creation-quotas|authorization-entitlements|policy.*serialization|(create|resource|playlist(-add|-item)?)(-delete)?-expiry|auth-performance)\.test\./.test(path);
}

function isDatabaseTest(path) {
	const normalized = path.replaceAll("\\", "/");
	return /\/test\/mcp\/(integration|contract|workflows)\//.test(normalized) || /\/test\/auth-engine-rewrite\/integration\/(creator-onboarding-trigger|provider-credential-switch)\.test\./.test(normalized) || /coverage-(collector|parallel|next-entries)\.test\./.test(normalized);
}

/** Uses the installed Jest runner and its events/results for every suite. */
module.exports = class McpTestRunner extends DefaultRunner {
	async runTests(tests, watcher, options) {
		const original = this._globalConfig;
		const quiet = tests.filter((test) => isQuietTest(test.path));
		const ordinary = tests.filter((test) => !isQuietTest(test.path));
		const phases = [
			{ name: "ordinary", tests: ordinary.filter((test) => !isDatabaseTest(test.path)), serial: options.serial },
			{ name: "database", tests: ordinary.filter((test) => isDatabaseTest(test.path)), serial: options.serial },
			{ name: "quiet timing/races", tests: quiet, serial: true },
		];
		let compiledDirectory;
		const previousRuntime = process.env.MCP_PROBE_RUNTIME;
		const previousDirectory = process.env.MCP_COVERAGE_PROBE_DIRECTORY;
		try {
			if (!previousDirectory && tests.some((test) => isDatabaseTest(test.path) || (isQuietTest(test.path) && test.path.replaceAll("\\", "/").includes("/test/mcp/")))) {
				mkdirSync("test-results/mcp", { recursive: true });
				compiledDirectory = mkdtempSync(resolve("test-results/mcp/compiled-tests-"));
				const { buildMcpCoverageProbes } = await import("./build-mcp-coverage-probes.mjs");
				await buildMcpCoverageProbes({ outputDirectory: compiledDirectory });
				process.env.MCP_COVERAGE_PROBE_DIRECTORY = compiledDirectory;
				process.env.MCP_PROBE_RUNTIME = previousRuntime ?? "node";
				console.error("[tests] Native application probes compiled once for this run");
			}
			for (const phase of phases) {
				if (!phase.tests.length || watcher.isInterrupted()) continue;
				const available = selectTestWorkers(readTestSystem(), String(original.maxWorkers));
				const databaseBudget = phase.name === "database" && !phase.serial ? selectDatabaseWorkers(available, await readFixtureDatabaseCapacity()) : available;
				const workers = phase.serial ? 1 : Math.min(phase.tests.length, databaseBudget);
				this._globalConfig = { ...original, maxWorkers: workers };
				console.error(`[tests] ${phase.name}: ${phase.tests.length} suites, ${workers} worker(s)`);
				await super.runTests(phase.tests, watcher, { ...options, serial: phase.serial || workers === 1 });
			}
		} finally {
			this._globalConfig = original;
			if (compiledDirectory) {
				rmSync(compiledDirectory, { recursive: true, force: true });
				if (previousDirectory === undefined) delete process.env.MCP_COVERAGE_PROBE_DIRECTORY;
				else process.env.MCP_COVERAGE_PROBE_DIRECTORY = previousDirectory;
				if (previousRuntime === undefined) delete process.env.MCP_PROBE_RUNTIME;
				else process.env.MCP_PROBE_RUNTIME = previousRuntime;
			}
		}
	}
};
