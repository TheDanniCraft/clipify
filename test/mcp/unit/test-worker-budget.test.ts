/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function configuredWorkers(cpuCount: number, freeGiB: number, totalGiB: number, override?: string) {
	mkdirSync("test-results/mcp", { recursive: true });
	const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/worker-profile-"));
	const preload = join(directory, "profile.mjs");
	writeFileSync(preload, `import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';os.availableParallelism=()=>${cpuCount};os.freemem=()=>${freeGiB}*1024**3;os.totalmem=()=>${totalGiB}*1024**3;syncBuiltinESMExports();`);
	const env = { ...process.env };
	delete env.MCP_TEST_WORKERS;
	if (override !== undefined) env.MCP_TEST_WORKERS = override;
	try {
		const run = spawnSync(process.execPath, ["--import", preload, "scripts/run-mcp-coverage.mjs", "test/mcp/unit/quota-contract.test.ts", "test/mcp/unit/scopes.test.ts", "--showConfig", `--coverageDirectory=${directory}/coverage`], { encoding: "utf8", timeout: 30000, env });
		if (run.error) throw run.error;
		const start = run.stdout.indexOf('{\n  "configs":');
		if (start < 0) throw new Error(`Valid test configuration was not returned: ${run.stderr}`);
		const end = run.stdout.indexOf("\n}", start) + 2;
		return JSON.parse(run.stdout.slice(start, end)).globalConfig.maxWorkers as number;
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

test("automatic test workers use independent suites on a large machine", () => {
	expect(configuredWorkers(16, 64, 128)).toBeGreaterThan(1);
});

test("automatic test workers preserve memory reserve on a small busy machine", () => {
	expect(configuredWorkers(4, 1.5, 8)).toBe(1);
});

test("an explicit lower worker override is honored", () => {
	expect(configuredWorkers(16, 64, 128, "1")).toBe(1);
});

const { selectTestWorkers } = require("../../../scripts/test-worker-budget.cjs");

test.each([
	[16, 64, 128, 8],
	[12, 40, 64, 8],
	[8, 6, 8, 2],
	[8, 4, 8, 1],
	[4, 1.5, 8, 1],
	[2, 64, 128, 1],
	[1, 64, 128, 1],
])("CPU%s/free%sGiB/total%sGiB yields%sordinary workers", (cpuCount, freeGiB, totalGiB, expected) => {
	expect(selectTestWorkers({ cpuCount, availableMemoryBytes: freeGiB * 1024 ** 3, totalMemoryBytes: totalGiB * 1024 ** 3 })).toBe(expected);
});

test.each(["0", "-1", "1.5", "65", "abc", " 2"])("invalid worker override %s is rejected", (override) => {
	expect(() => selectTestWorkers({ cpuCount: 16, availableMemoryBytes: 64 * 1024 ** 3, totalMemoryBytes: 128 * 1024 ** 3 }, override)).toThrow("MCP_TEST_WORKERS");
});

test("manual worker count remains bounded by memory and CPU reserve", () => {
	expect(selectTestWorkers({ cpuCount: 16, availableMemoryBytes: 64 * 1024 ** 3, totalMemoryBytes: 128 * 1024 ** 3 }, "64")).toBe(15);
	expect(selectTestWorkers({ cpuCount: 4, availableMemoryBytes: 1.5 * 1024 ** 3, totalMemoryBytes: 8 * 1024 ** 3 }, "8")).toBe(1);
});

test("unknown resource metrics fail conservatively to one worker", () => {
	expect(selectTestWorkers({ cpuCount: NaN, availableMemoryBytes: Infinity, totalMemoryBytes: 0 })).toBe(1);
});
