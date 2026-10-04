import { spawnSync } from "node:child_process";

const stages = [
	["bddgen"],
	["playwright", "test", "--project=acceptance-chromium", "--workers=1"],
	// Restart the development server between ATDD shards. Compiled route modules
	// remain resident in Next.js, and the complete journey suite can otherwise
	// exhaust the CI runner heap before global teardown gets a chance to run.
	["playwright", "test", "--project=atdd-chromium", "--workers=1", "--shard=1/2"],
	["playwright", "test", "--project=atdd-chromium", "--workers=1", "--shard=2/2"],
	["playwright", "test", "--project=bdd-chromium", "--workers=1"],
	["playwright", "test", "--project=compliance-chromium", "--workers=1"],
] as const;
for (const args of stages) {
	const result = spawnSync(process.execPath, ["x", ...args], {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
