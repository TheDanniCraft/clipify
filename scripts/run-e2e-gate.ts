import { spawnSync } from "node:child_process";

// Build once instead of retaining an expanding development compiler for every journey.
const build = spawnSync(process.execPath, ["run", "test:e2e:build"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const stages: string[][] = [["bddgen"], ["playwright", "test", "--project=acceptance-chromium", "--workers=1"], ["playwright", "test", "--project=atdd-chromium", "--workers=1"], ["playwright", "test", "--project=bdd-chromium", "--workers=1"], ["playwright", "test", "--project=compliance-chromium", "--workers=1"]];
for (const args of stages) {
	const project = args.find((argument) => argument.startsWith("--project="))?.slice("--project=".length);
	const stageArguments = project ? [...args, `--output=test-results/browser-${project}`] : args;
	const result = spawnSync(process.execPath, ["x", ...stageArguments], {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
