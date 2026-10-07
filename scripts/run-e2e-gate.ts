import { spawnSync } from "node:child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readTestSystem } = require("./test-worker-budget.cjs");
const { availableMemoryBytes } = readTestSystem();
// Keep compiled development routes bounded on smaller runners. Every shard runs;
// each has a fresh server and executes its normal teardown.
const journeyShards = availableMemoryBytes < 16 * 1024 ** 3 ? 4 : 2;
const stages: string[][] = [
	["bddgen"],
	["playwright", "test", "--project=acceptance-chromium", "--workers=1"],
	...Array.from({ length: journeyShards }, (_, index) => ["playwright", "test", "--project=atdd-chromium", "--workers=1", `--shard=${index + 1}/${journeyShards}`]),
	...Array.from({ length: journeyShards }, (_, index) => ["playwright", "test", "--project=bdd-chromium", "--workers=1", `--shard=${index + 1}/${journeyShards}`]),
	["playwright", "test", "--project=compliance-chromium", "--workers=1"],
];
for (const args of stages) {
	const result = spawnSync(process.execPath, ["x", ...args], {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
