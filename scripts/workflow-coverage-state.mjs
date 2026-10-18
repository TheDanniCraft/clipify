import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Interrupted producers must never lend source counters or results to a fresh run. */
export function resetWorkflowCoverageArtifacts(directory) {
	mkdirSync(directory, { recursive: true });
	for (const artifact of ["raw", "probes", "mcp-workflows", "coverage-final.json", "workflow-results.json", "workflow-inventory.json", "lane.json"]) rmSync(join(directory, artifact), { recursive: true, force: true });
}
