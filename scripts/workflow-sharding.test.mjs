import { test } from "node:test";
import assert from "node:assert/strict";
import { workflowLaneSelection, workflowExecutionCommands } from "./run-mcp-workflow-coverage.mjs";
test("protocol shards exclude real media while its owner stays serial", () => {
	assert.deepEqual(workflowLaneSelection("workflows-1"), { parallel: true, serial: false, shard: ["--shard=1/2"] });
	assert.deepEqual(workflowLaneSelection("workflows-2"), { parallel: true, serial: false, shard: ["--shard=2/2"] });
	assert.deepEqual(workflowLaneSelection("workflows-media"), { parallel: false, serial: true, shard: [] });
	assert.throws(() => workflowLaneSelection("workflows-3"), /Unknown/);
	const [parallel, serial] = workflowExecutionCommands(4, "playwright", "workflows-2");
	assert.ok(parallel.includes("--shard=2/2"));
	assert.ok(parallel.includes("--grep-invert"));
	assert.ok(serial.includes("--workers=1"));
	assert.ok(!serial.some((a) => a.startsWith("--shard=")));
});

test("workflow planning follows elapsed work without a fixed protocol-job ceiling", async () => {
	const { planWorkflowShards } = await import("./workflow-test-planning.cjs");
	const file = ".features-gen/bdd/protocol.feature.spec.js";
	const specs = Array.from({ length: 30 }, (_, i) => ({ id: String(i), title: `Case ${i}`, file, tags: [], tests: [{ projectName: "bdd-chromium" }] }));
	const report = { suites: [{ title: file, file, suites: [{ title: "Protocol", specs }] }] };
	const profile = { "bdd/protocol.feature.spec.js": 3000 };
	const plan = planWorkflowShards(report, profile, 1);
	assert.equal(Object.keys(plan.lanes).length, 10);
	assert.equal(Object.values(plan.lanes).flatMap((l) => l.testIds).length, 30);
});

test("planned workflow producers generate scenarios on a fresh checkout before execution", async () => {
	const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs"),
		{ join } = await import("node:path"),
		{ tmpdir } = await import("node:os"),
		{ execFileSync } = await import("node:child_process");
	const directory = mkdtempSync(join(tmpdir(), "clipify-workflow-sequence-")),
		plan = join(directory, "plan.json");
	writeFileSync(plan, JSON.stringify({ lanes: { sample: { kind: "protocol", selectors: ["example.spec.js"], testIds: ["case:bdd-chromium"] } } }));
	const code = `import cp from 'node:child_process';import{syncBuiltinESMExports,createRequire}from'node:module';const calls=[];cp.spawnSync=(_command,args)=>{calls.push(args);return{status:calls.length===1?0:1};};syncBuiltinESMExports();const require=createRequire(import.meta.url);require('./scripts/test-database-budget.cjs').readFixtureDatabaseCapacity=async()=>undefined;const{collectMcpWorkflowCoverage}=await import('./scripts/run-mcp-workflow-coverage.mjs');const passed=await collectMcpWorkflowCoverage({environment:{},rawDirectory:process.argv[1],outputDirectory:process.argv[1],lane:'sample'});process.stdout.write(JSON.stringify({passed,calls}));`;
	try {
		const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, directory], { encoding: "utf8", env: { ...process.env, CLIPIFY_WORKFLOW_SHARD_PLAN: plan } }));
		assert.equal(result.passed, false);
		assert.ok(result.calls[0][0].includes("playwright-bdd"));
		assert.ok(result.calls[1].includes("--test-list"));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
