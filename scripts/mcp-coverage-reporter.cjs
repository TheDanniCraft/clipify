/* eslint-disable @typescript-eslint/no-require-imports */
const { readdirSync, readFileSync, unlinkSync, mkdirSync, existsSync } = require("node:fs");
const { resolve, join, basename } = require("node:path");
const { Report } = require("c8");
const { createCoverageMap } = require("istanbul-lib-coverage");
const { createSourceMapStore } = require("istanbul-lib-source-maps");
const { repairMappedCoverage } = require("./mcp-coverage-ranges.cjs");
const { suiteCoverageDirectory } = require("./mcp-coverage-paths.cjs");

/** Runs before Jest's built-in coverage reporter merges each test result. */
module.exports = class McpCoverageReporter {
	constructor(config, options = {}) {
		this.enabled = config.collectCoverage;
		this.rawDirectory = options.rawDirectory || process.env.MCP_V8_COVERAGE_DIR;
		this.outputDirectory = options.outputDirectory || join(config.coverageDirectory || "coverage", "mcp-child");
	}
	async onTestResult(_test, result) {
		if (!this.enabled || !this.rawDirectory) return;
		try {
			const rawDirectory = suiteCoverageDirectory(this.rawDirectory, result.testFilePath || _test.path);
			const files = existsSync(rawDirectory) ? readdirSync(rawDirectory).filter((file) => /^(coverage-|istanbul-).*\.json$/.test(file)) : [];
			const { readMcpSourceManifest } = await import("./check-mcp-coverage.mjs");
			const required = new Set(readMcpSourceManifest().feature.map((path) => resolve(path)));
			const raw = createCoverageMap(result.coverage || {});
			for (const name of files.filter((file) => file.startsWith("istanbul-"))) {
				for (const [path, file] of Object.entries(JSON.parse(readFileSync(join(rawDirectory, name), "utf8")))) {
					if (required.has(resolve(path))) raw.addFileCoverage({ ...file, path: resolve(path) });
				}
			}
			// Parent and native probes share the installed Jest counter metadata.
			// Merge those raw obligations first and remap the combined source once.
			const sourceMaps = createSourceMapStore();
			const mapped = await sourceMaps.transformCoverage(raw);
			const parent = createCoverageMap(repairMappedCoverage(mapped.toJSON()));
			result.coverage = parent.toJSON();
			sourceMaps.dispose();
			if (!files.length) return;
			const outputDirectory = rawDirectory === this.rawDirectory ? this.outputDirectory : join(this.outputDirectory, basename(rawDirectory));
			mkdirSync(outputDirectory, { recursive: true });
			if (!files.some((file) => file.startsWith("coverage-"))) {
				require("node:fs").writeFileSync(join(outputDirectory, "coverage-final.json"), JSON.stringify(parent.toJSON()));
				for (const name of files) unlinkSync(join(rawDirectory, name));
				return;
			}
			// Keep the existing raw V8 calibration path for non-instrumented probes.
			await new Report({
				tempDirectory: rawDirectory,
				reporter: ["json"],
				reportsDirectory: outputDirectory,
				// Node's cached multi-source maps use file URLs. c8's post-remap
				// glob matcher excludes their ranges; select actual ESM probes first
				// and filter their remapped filesystem paths below instead.
				include: ["test-results/mcp/**/*-probe.mjs"],
				excludeAfterRemap: false,
				extension: [".js", ".mjs", ".ts", ".tsx"],
				excludeNodeModules: true,
				wrapperLength: 0,
			}).run();
			const child = JSON.parse(readFileSync(join(outputDirectory, "coverage-final.json"), "utf8"));
			const combined = parent;
			for (const [path, file] of Object.entries(repairMappedCoverage(child))) {
				if (required.has(resolve(path))) combined.addFileCoverage({ ...file, path: resolve(path) });
			}
			result.coverage = combined.toJSON();
			for (const file of files) unlinkSync(join(rawDirectory, file));
		} catch (error) {
			this.error = new Error(`MCP child source coverage collection failed: ${error.message}`);
		}
	}
	getLastError() {
		return this.error;
	}
};
