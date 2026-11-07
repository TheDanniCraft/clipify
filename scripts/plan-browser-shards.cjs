/* eslint-disable @typescript-eslint/no-require-imports */
const { listBrowserTests, planBrowserProjects, BROWSER_PROJECTS } = require("./browser-sharding.cjs");
const { mkdirSync, writeFileSync, appendFileSync } = require("node:fs");
const projects = planBrowserProjects(listBrowserTests([], BROWSER_PROJECTS));
const include = Object.entries(projects).flatMap(([project, shards]) => shards.map((part, i) => ({ project, shard: `${i + 1}/${shards.length}`, label: `${project.replace("-chromium", "")}-${i + 1}`, native_media: part.nativeMedia, ffmpeg: part.ffmpeg || project === "acceptance-chromium" })));
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/browser-shard-plan.json", JSON.stringify({ projects }, null, 2) + "\n");
const summary = Object.entries(projects)
	.map(([project, shards]) => `${project}: ${shards.length} balanced shards; longest estimate ${(Math.max(...shards.map((s) => s.estimatedSeconds)) / 60).toFixed(1)} minutes; ${shards.reduce((n, s) => n + s.newTests, 0)} new scenarios.`)
	.join("\n");
console.log(summary);
const slow = Object.entries(projects).flatMap(([project, shards]) => shards.filter((s) => s.estimatedSeconds > 300).map((s) => `${project}: indivisible fixture group exceeds five minutes: ${s.selectors.join(", ")}`));
if (slow.length) console.warn(slow.join("\n"));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include })}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Browser target: five minutes of measured work per shard. Queue and external bootstrap are additional.\n\n${summary}\n${slow.join("\n")}\n`);
