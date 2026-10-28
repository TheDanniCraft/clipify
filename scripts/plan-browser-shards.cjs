/* eslint-disable @typescript-eslint/no-require-imports */
const { listBrowserTests, planBrowserShards } = require("./browser-sharding.cjs");
const { mkdirSync, writeFileSync, appendFileSync } = require("node:fs");
const shards = planBrowserShards(listBrowserTests());
const fixed = [
	{ project: "acceptance-chromium", shard: "1/1", label: "acceptance" },
	{ project: "atdd-chromium", shard: "1/1", label: "atdd" },
	{ project: "compliance-chromium", shard: "1/1", label: "compliance" },
];
const include = [...fixed, ...shards.map((_, i) => ({ project: "bdd-chromium", shard: `${i + 1}/${shards.length}`, label: `bdd-${i + 1}` }))];
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/browser-shard-plan.json", JSON.stringify({ shards }, null, 2) + "\n");
const longest = Math.max(...shards.map((s) => s.estimatedSeconds));
const summary = `Browser plan: ${shards.length} BDD shards, five-minute estimated-work target, maximum 10 BDD shards. Longest estimated shard: ${(longest / 60).toFixed(1)} minutes. Setup and queues are additional.${longest > 300 ? " The target exceeds available capacity; optimize slow tests or review the budget." : ""}`;
console.log(summary);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include })}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
