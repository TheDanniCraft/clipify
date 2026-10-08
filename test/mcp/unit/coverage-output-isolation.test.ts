/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

test.each(["serial", "parallel"])(
	"%s nested coverage calibration preserves its enclosing report and checks its own output",
	(mode) => {
		mkdirSync("test-results/mcp", { recursive: true });
		const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/output-isolation-"));
		const parentOutput = join(directory, "parent");
		mkdirSync(parentOutput);
		const outerReport = join(parentOutput, "coverage-final.json");
		const sentinel = '{"enclosingMeasurement":"must-be-preserved"}\n';
		writeFileSync(outerReport, sentinel);
		try {
			const output = join(directory, "coverage");
			const run = spawnSync(process.execPath, ["scripts/run-mcp-coverage.mjs", "test/mcp/unit/quota-contract.test.ts", `--coverageDirectory=${output}`, "--coverageReporters=json", "--collectCoverageFrom=src/server/resources/quota.ts", ...(mode === "parallel" ? ["--maxWorkers=2"] : [])], { encoding: "utf8", timeout: 90000, env: { ...process.env, MCP_COVERAGE_DIRECTORY: parentOutput } });
			if (run.error) throw run.error;
			expect(readFileSync(outerReport, "utf8")).toBe(sentinel);
			expect(existsSync(join(output, "coverage-final.json"))).toBe(true);
			const start = run.stdout.lastIndexOf('{\n  "ok":');
			expect(start).toBeGreaterThanOrEqual(0);
			const gate = JSON.parse(run.stdout.slice(start));
			const report = JSON.parse(readFileSync(join(output, "coverage-final.json"), "utf8"));
			const quota = Object.entries(report).find(([path]) => path.endsWith("/resources/quota.ts"))?.[1] as { s: Record<string, number> };
			expect(quota).toBeDefined();
			expect(Object.values(quota.s).some((counter) => counter > 0)).toBe(true);
			expect(gate.ok).toBe(false);
			expect(gate.files["src/server/resources/quota.ts"].functions.pct).toBe(100);
			expect(run.status).toBe(1);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	100000,
);
