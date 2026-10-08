/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test.each(["integration", "workflows"])(
	"actual %s database lane honors available PostgreSQL slots rather than CPU workers alone",
	(lane) => {
		mkdirSync("test-results/mcp", { recursive: true });
		const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/runner-database-"));
		const fixtures = join(directory, `test/mcp/${lane}`);
		mkdirSync(fixtures, { recursive: true });
		const plans = join(directory, "plans.jsonl");
		const output = join(directory, "result.json");
		const preload = join(directory, "profile.mjs");
		writeFileSync(
			preload,
			`import fs from 'node:fs';import os from 'node:os';import pg from 'pg';import runner from 'jest-runner';import{fileURLToPath}from'node:url';import{syncBuiltinESMExports}from'node:module';os.availableParallelism=()=>8;os.totalmem=()=>32*1024**3;os.freemem=()=>24*1024**3;const read=fs.readFileSync;fs.readFileSync=(path,...args)=>typeof path==='string'&&path.startsWith('/sys/fs/cgroup/')?(path.endsWith('cpu.max')?'max 100000':'max'):read(path,...args);syncBuiltinESMExports();pg.Pool=class{async query(){return{rows:[{max_connections:64,reserved_connections:3,active_connections:29}]};}async end(){}};const Base=runner.default??runner,run=Base.prototype.runTests;Base.prototype.runTests=function(tests,watcher,options){fs.appendFileSync(fileURLToPath(new URL('plans.jsonl',import.meta.url)),JSON.stringify({workers:this._globalConfig.maxWorkers,serial:options.serial,files:tests.length})+'\\n');return run.call(this,tests,watcher,options);};`,
		);
		for (const name of ["one", "two", "three"]) writeFileSync(join(fixtures, `${name}.test.cjs`), "/** @jest-environment node */\ntest('independent database-lane fixture',()=>expect(true).toBe(true));\n");
		try {
			const run = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", fixtures, "--roots", fixtures, "--testMatch=**/*.test.cjs", "--maxWorkers=3", "--json", "--outputFile", output], { encoding: "utf8", timeout: 45000, env: { ...process.env, MCP_TEST_DATABASE_URL: "postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture", NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(preload).href}` } });
			if (run.error) throw run.error;
			expect(run.status).toBe(0);
			const result = JSON.parse(readFileSync(output, "utf8"));
			expect(result.numPassedTests).toBe(3);
			expect(result.numPendingTests).toBe(0);
			const calls = readFileSync(plans, "utf8")
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			expect(calls).toEqual([{ workers: 1, serial: true, files: 3 }]);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	50000,
);
