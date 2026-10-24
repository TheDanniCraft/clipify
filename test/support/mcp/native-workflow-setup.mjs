import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { buildMcpCoverageProbes } from "../../../scripts/build-mcp-coverage-probes.mjs";

/** Preserve the coverage owner's producer; focused runs compile the same RSC aliases without instrumentation. */
export default async function setupNativeWorkflows() {
	process.env.MCP_PROBE_RUNTIME = "node";
	if (process.env.MCP_COVERAGE_PROBE_DIRECTORY) return;
	await mkdir(resolve("test-results/mcp"), { recursive: true });
	const directory = await mkdtemp(join(resolve("test-results/mcp"), "native-dev-probes-"));
	try {
		await buildMcpCoverageProbes({ outputDirectory: directory, instrument: false });
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
	process.env.MCP_COVERAGE_PROBE_DIRECTORY = directory;
	return async () => {
		delete process.env.MCP_COVERAGE_PROBE_DIRECTORY;
		await rm(directory, { recursive: true, force: true });
	};
}
