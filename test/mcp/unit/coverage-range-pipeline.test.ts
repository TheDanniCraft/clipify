/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
test("final real Jest quota ranges are valid without relaxing partial-run coverage gates", () => {
	mkdirSync("test-results/mcp", { recursive: true });
	const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/range-pipeline-"));
	try {
		const run = spawnSync(process.execPath, ["scripts/run-mcp-coverage.mjs", "test/mcp/unit/quota-contract.test.ts", `--coverageDirectory=${directory}`, "--coverageReporters=json", "--collectCoverageFrom=src/server/resources/quota.ts"], { encoding: "utf8", timeout: 90000 });
		if (run.error) throw run.error;
		const start = run.stdout.lastIndexOf('{\n  "ok":');
		expect(start).toBeGreaterThanOrEqual(0);
		const gate = JSON.parse(run.stdout.slice(start));
		const files = JSON.parse(readFileSync(join(directory, "coverage-final.json"), "utf8"));
		const quota = Object.entries(files).find(([name]) => name.endsWith("/resources/quota.ts"))?.[1] as { statementMap: Record<string, { start: { line: number }; end: { line: number } }> };
		expect(quota).toBeDefined();
		for (const range of Object.values(quota.statementMap)) expect(range.end.line).toBeGreaterThanOrEqual(range.start.line);
		expect(gate.errors).not.toContain("Invalid source coverage counters or mappings: src/server/resources/quota.ts");
		// A partial measurement must still fail the mandatory cold-file/global gates.
		expect(run.status).toBe(1);
		expect(gate.ok).toBe(false);
		expect(gate.errors.length).toBeGreaterThan(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 100000);
