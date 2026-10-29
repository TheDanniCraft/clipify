import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharding from "./browser-sharding.cjs";

const [project, shard = "1/1"] = process.argv.slice(2);
const [index, count] = shard.split("/").map(Number);
if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 1 || index > count) throw Error("Invalid browser shard");
const cli = "node_modules/@playwright/test/cli.js";
const directory = mkdtempSync(join(tmpdir(), "clipify-browser-shard-"));
try {
	let selected = [];
	if (project === "bdd-chromium") {
		const inventory = sharding.listBrowserTests();
		const planFile = process.env.CLIPIFY_BROWSER_SHARD_PLAN;
		const shards = planFile ? JSON.parse(readFileSync(planFile, "utf8")).shards : null;
		if (shards) {
			const expected = sharding
				.browserTestCases(inventory)
				.map((c) => c.id)
				.sort();
			const planned = shards.flatMap((s) => s.testIds).sort();
			if (shards.length !== count || new Set(planned).size !== planned.length || JSON.stringify(expected) !== JSON.stringify(planned)) throw Error("Browser plan does not match the complete current scenario inventory");
		}
		const part = shards ? shards[index - 1] : sharding.selectBrowserTests(inventory, index - 1, count);
		if (!part.testIds.length) throw Error("Browser shard has no scenarios");
		const list = join(directory, "tests.txt");
		writeFileSync(list, part.selectors.join("\n") + "\n");
		selected = ["--test-list", list];
		const actual = sharding
			.browserTestCases(sharding.listBrowserTests(selected))
			.map((c) => c.id)
			.sort();
		if (JSON.stringify(actual) !== JSON.stringify([...part.testIds].sort())) throw Error("Browser test selectors did not resolve to the exact planned scenarios");
	}
	const result = spawnSync(process.execPath, [cli, "test", `--project=${project}`, "--workers=1", ...selected], { stdio: "inherit" });
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
} finally {
	rmSync(directory, { recursive: true, force: true });
}
