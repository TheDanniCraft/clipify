/* eslint-disable @typescript-eslint/no-require-imports */
const { listBrowserTests, planBrowserShards } = require("./browser-sharding.cjs");
const { mkdirSync, writeFileSync, appendFileSync } = require("node:fs");
const fixed = [
	{ project: "acceptance-chromium", shard: "1/1", label: "acceptance" },
	{ project: "atdd-chromium", shard: "1/1", label: "atdd" },
	{ project: "compliance-chromium", shard: "1/1", label: "compliance" },
];
const shards = planBrowserShards(listBrowserTests());

const include = [...fixed, ...shards.map((part, i) => ({ project: "bdd-chromium", shard: `${i + 1}/${shards.length}`, label: `bdd-${i + 1}`, native_media: part.nativeMedia, ffmpeg: part.ffmpeg }))];
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/browser-shard-plan.json", JSON.stringify({ shards }, null, 2) + "\n");
const longest = Math.max(...shards.map((s) => s.estimatedSeconds));
const summary = `Browser plan: ${shards.length} BDD shards, five-minute estimated-work target, GitHub manages available runner concurrency. Longest estimated shard: ${(longest / 60).toFixed(1)} minutes. Estimates include measured Playwright startup when available; external job setup and queues are additional.${longest > 300 ? " A fixture group exceeds the target; inspect its setup or safe splitting." : ""}`;
console.log(summary);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include })}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
