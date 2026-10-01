import { spawnSync } from "node:child_process";

const stages = [["bddgen"], ["playwright", "test", "--project=acceptance-chromium", "--workers=1"], ["playwright", "test", "--project=atdd-chromium", "--workers=1"], ["playwright", "test", "--project=bdd-chromium", "--workers=1"], ["playwright", "test", "--project=compliance-chromium", "--workers=1"]] as const;
for (const args of stages) {
	const result = spawnSync(process.execPath, ["x", ...args], {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
