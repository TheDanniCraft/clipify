/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import coveragePaths from "../../../scripts/mcp-coverage-paths.cjs";
test("inactive connection cleanup preserves active authority and audit history in PostgreSQL", () => {
	const directory = process.env.MCP_COVERAGE_PROBE_DIRECTORY;
	const entry = directory ? join(directory, "purge-connections-probe.mjs") : join(process.cwd(), "test/support/mcp/purge-connections-probe.ts");
	const environment = { ...process.env };
	if (process.env.MCP_V8_COVERAGE_DIR) {
		const rawDirectory = coveragePaths.suiteCoverageDirectory(process.env.MCP_V8_COVERAGE_DIR, expect.getState().testPath);
		mkdirSync(rawDirectory, { recursive: true });
		environment.MCP_ISTANBUL_COVERAGE_DIR = rawDirectory;
	}
	const result = spawnSync(process.execPath, ["--conditions=react-server", ...(!directory ? ["--import", "tsx"] : []), "--test", entry], { encoding: "utf8", timeout: 30000, env: environment });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
