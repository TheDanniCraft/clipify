import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import coveragePaths from "../../../scripts/mcp-coverage-paths.cjs";
export function runMcpProbe(name: string, args: string[], timeout = 30000): any {
	// Public Next entries need Node request-context semantics; Bun RSC imports differ.
	const node = name === "websocket-runtime-probe" || process.env.MCP_PROBE_RUNTIME === "node" || (name === "browser-playlist-delete-probe" && args[0]?.startsWith("volume-public"));
	const directory = process.env.MCP_COVERAGE_PROBE_DIRECTORY;
	const entry = node && directory ? join(directory, `${name}.mjs`) : `test/support/mcp/${name}.ts`;
	let environment = process.env;
	if (node && process.env.MCP_V8_COVERAGE_DIR) {
		const testPath = typeof expect === "function" ? expect.getState().testPath : undefined;
		const rawDirectory = coveragePaths.suiteCoverageDirectory(process.env.MCP_V8_COVERAGE_DIR, testPath);
		mkdirSync(rawDirectory, { recursive: true });
		if (process.env.MCP_PROBE_COVERAGE_PROVIDER === "istanbul") {
			environment = { ...process.env, MCP_ISTANBUL_COVERAGE_DIR: rawDirectory };
			delete environment.NODE_V8_COVERAGE;
		} else environment = { ...process.env, NODE_V8_COVERAGE: rawDirectory };
	}
	const output = execFileSync(node ? process.execPath : "bun", ["--conditions=react-server", ...(node && !directory ? ["--import=tsx"] : []), entry, ...args], { encoding: "utf8", timeout, env: environment });
	return JSON.parse(output.trim().split("\n").at(-1)!);
}
export function providerProbe(mode: string, input?: unknown): { status: number; body: any } {
	return runMcpProbe("provider-probe", [mode, ...(input ? [JSON.stringify(input)] : [])], 15000);
}
export function flowProbe(mode: string): any {
	return runMcpProbe("flow-probe", [mode], mode.endsWith(":snapshot_expired") ? 45000 : 30000);
}
