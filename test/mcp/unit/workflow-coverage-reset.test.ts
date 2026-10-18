/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("DEF-US3-173: a fresh workflow producer discards interrupted counters and results while preserving other lanes", () => {
	const root = mkdtempSync(join(tmpdir(), "clipify-workflow-reset-"));
	const output = join(root, "workflows");
	const stale = ["raw/istanbul-interrupted.json", "probes/flow-probe.mjs", "mcp-workflows/coverage-final.json", "coverage-final.json", "workflow-results.json", "workflow-inventory.json", "lane.json"];
	const sentinel = join(root, "application", "coverage-final.json");
	try {
		for (const file of stale) {
			const path = join(output, file);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, "stale interrupted source");
		}
		mkdirSync(dirname(sentinel));
		writeFileSync(sentinel, "qualified application evidence");
		const entry = pathToFileURL(resolve("scripts/workflow-coverage-state.mjs")).href;
		const run = () => spawnSync(process.execPath, ["--input-type=module", "--eval", `const { resetWorkflowCoverageArtifacts } = await import(${JSON.stringify(entry)}); resetWorkflowCoverageArtifacts(process.argv[1]);`, output], { encoding: "utf8" });
		const result = run();
		expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
		for (const file of stale) expect(existsSync(join(output, file))).toBe(false);
		expect(readFileSync(sentinel, "utf8")).toBe("qualified application evidence");
		expect(run().status).toBe(0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
