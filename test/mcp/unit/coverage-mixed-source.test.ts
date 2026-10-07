/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
test("mixed parent and native calls count each original source definition once without false cold duplicates", () => {
	mkdirSync("test-results/mcp", { recursive: true });
	const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/mixed-source-"));
	try {
		const run = spawnSync(
			process.execPath,
			[
				"scripts/run-mcp-coverage.mjs",
				"test/mcp/unit/overlay-effect-budget.test.ts",
				"test/mcp/integration/overlay-effect-worker.test.ts",
				"test/mcp/integration/overlay-reward-http.test.ts",
				"test/mcp/contract/transport.test.ts",
				"--testNamePattern=empty batch at valid bound|provider failure leaves durable retry|actual reward provider HTTP accepted|legacy stateless transport|modern discover",
				`--coverageDirectory=${directory}`,
				"--coverageReporters=json",
				"--collectCoverageFrom=src/server/resources/overlay-effects.ts",
				"--maxWorkers=2",
				"--json",
				`--outputFile=${directory}/results.json`,
			],
			{ encoding: "utf8", timeout: 90000 },
		);
		if (run.error) throw run.error;
		const result = JSON.parse(readFileSync(join(directory, "results.json"), "utf8"));
		expect(result.numFailedTests).toBe(0);
		expect(result.numPassedTests).toBe(6);
		const all = JSON.parse(readFileSync(join(directory, "coverage-final.json"), "utf8"));
		const source = all[Object.keys(all).find((path) => path.endsWith("/resources/overlay-effects.ts"))!];
		expect(source).toBeDefined();
		for (const name of ["enqueueOverlayRewardEffect", "subscribeOverlayReward", "readRewardAppToken"]) {
			const ids = Object.keys(source.fnMap).filter((id) => source.fnMap[id].name === name);
			expect({ name, definitions: ids.length }).toEqual({ name, definitions: 1 });
			expect(source.f[ids[0]]).toBeGreaterThan(0);
		}
		const cold = Object.keys(source.s).filter((id) => source.s[id] === 0);
		expect(cold.length).toBeGreaterThan(0);
		expect(run.status).toBe(1); // A focused run still cannot satisfy the complete feature gate.
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 100000);
