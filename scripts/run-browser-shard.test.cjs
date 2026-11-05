/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("node:fs"),
	{ join, resolve } = require("node:path"),
	{ spawnSync } = require("node:child_process");
const { BROWSER_PROJECTS } = require("./browser-sharding.cjs");
for (const project of BROWSER_PROJECTS)
	test(`${project} executes exactly its planned shard and rejects a missing or foreign inventory`, () => {
		const dir = fs.mkdtempSync(join(require("node:os").tmpdir(), "browser-owner-"));
		try {
			const plan = join(dir, "plan.json");
			const report = { suites: [{ title: "test/file.spec.ts", file: "test/file.spec.ts", specs: ["a", "b"].map((id) => ({ id, title: id, file: "test/file.spec.ts", tests: [{ projectName: project }] })) }] };
			const first = `[${project}] › test/file.spec.ts › a`,
				second = `[${project}] › test/file.spec.ts › b`;
			const shards = [
				{ testIds: ["a"], selectors: [first] },
				{ testIds: ["b"], selectors: [second] },
			];
			const code = `const cp=require('node:child_process'),fs=require('node:fs');const report=JSON.parse(process.env.REPORT);const sharding=require('./scripts/browser-sharding.cjs');sharding.listBrowserTests=(args,projects)=>{if(projects[0]!==process.env.PROJECT)throw Error('Foreign project');if(args.includes('--test-list')){const selected=fs.readFileSync(args[1],'utf8');const r=structuredClone(report);r.suites[0].specs=r.suites[0].specs.filter(s=>selected.includes(' › '+s.title+'\\n')||selected.includes(' › test/file.spec.ts\\n'));return r;}return report;};cp.spawnSync=(_cmd,args)=>{const file=args[args.indexOf('--test-list')+1];process.stdout.write(JSON.stringify({args,selectors:fs.readFileSync(file,'utf8')}));return{status:0};};require('node:module').syncBuiltinESMExports();process.argv=['node','scripts/run-browser-shard.mjs',process.env.PROJECT,process.env.SHARD||'1/2'];import('./scripts/run-browser-shard.mjs');`;
			const run = (extra = {}) => spawnSync(process.execPath, ["--eval", code], { cwd: resolve("."), encoding: "utf8", env: { ...process.env, PROJECT: project, REPORT: JSON.stringify(report), CLIPIFY_BROWSER_SHARD_PLAN: plan, ...extra } });
			fs.writeFileSync(plan, JSON.stringify({ projects: { [project]: shards } }));
			let result = run();
			assert.equal(result.status, 0, result.stderr);
			const actual = JSON.parse(result.stdout);
			assert.equal(actual.selectors, first + "\n");
			assert.ok(actual.args.includes(`--project=${project}`));
			const manual = run({ CLIPIFY_BROWSER_SHARD_PLAN: "", SHARD: "1/1" });
			assert.equal(manual.status, 0, manual.stderr);
			assert.equal(JSON.parse(manual.stdout).selectors, `[${project}] › test/file.spec.ts\n`);
			for (const invalid of [{ projects: {} }, { projects: { [project]: [shards[0], { testIds: ["foreign"], selectors: [second] }] } }, { projects: { [project]: [shards[0], shards[0]] } }]) {
				fs.writeFileSync(plan, JSON.stringify(invalid));
				result = run();
				assert.notEqual(result.status, 0);
				assert.equal(result.stdout, "");
			}
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
