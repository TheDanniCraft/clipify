import { execFileSync, spawnSync } from "node:child_process";
import execution from "./test-execution.cjs";

const [project, shard = "1/1"] = process.argv.slice(2);
const [index, count] = shard.split("/").map(Number);
const list = JSON.parse(execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", `--project=${project}`, "--list", "--reporter=json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
const files = [...new Set(list.suites.map((suite) => suite.file))];
const selected = project === "bdd-chromium" ? execution.selectBrowserFiles(files, index - 1, count) : files;
if (!selected.length) throw new Error("Browser shard has no scenarios");
const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", `--project=${project}`, "--workers=1", ...selected.map((file) => file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
