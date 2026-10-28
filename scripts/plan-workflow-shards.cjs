/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process"),
	{ mkdirSync, writeFileSync, appendFileSync } = require("node:fs");
const { readTestDurations } = require("./browser-sharding.cjs"),
	{ planWorkflowShards } = require("./workflow-test-planning.cjs"),
	{ automaticTestWorkers } = require("./test-worker-budget.cjs");
const env = { ...process.env };
delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
const report = JSON.parse(execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.mcp.config.ts", "--project=bdd-chromium", "--project=atdd-chromium", "--list", "--reporter=json"], { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
const profile = readTestDurations(),
	workers = automaticTestWorkers();
const plan = planWorkflowShards(report, profile, Math.min(4, workers));
const { planApplicationLanes, partitionTests } = require("./test-execution.cjs");
const paths = JSON.parse(execFileSync(process.execPath, ["node_modules/jest/bin/jest.js", "--listTests", "--json"], { env, encoding: "utf8" }));
plan.application = planApplicationLanes(paths, profile, workers);
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/workflow-shard-plan.json", JSON.stringify(plan, null, 2) + "\n");
const matrix = { lane: [...Object.keys(partitionTests(paths, plan.application)), ...Object.keys(plan.lanes)] };
console.log(`Native workflow plan: ${Object.keys(plan.lanes).length} elapsed-work-based jobs; no fixed job ceiling.`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
