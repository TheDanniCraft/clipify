/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("automatic runner finishes parallel ordinary suites before executing the quiet timing lane", () => {
	mkdirSync("test-results/mcp", { recursive: true });
	const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/runner-lanes-"));
	const eventsPath = join(directory, "events.jsonl");
	const resultPath = join(directory, "result.json");
	const sorter = join(directory, "sorter.cjs");
	const preload = join(directory, "hardware.mjs");
	writeFileSync(sorter, "const Base=require('@jest/test-sequencer').default;module.exports=class extends Base{sort(tests){return [...tests].sort((a,b)=>Number(b.path.includes('runtime-boundaries'))-Number(a.path.includes('runtime-boundaries'))||a.path.localeCompare(b.path));}};");
	writeFileSync(preload, "import os from 'node:os';import fs from 'node:fs';import{syncBuiltinESMExports}from'node:module';os.availableParallelism=()=>4;os.totalmem=()=>8*1024**3;os.freemem=()=>8*1024**3;const read=fs.readFileSync;fs.readFileSync=(path,...args)=>typeof path==='string'&&path.startsWith('/sys/fs/cgroup/')?(path.endsWith('cpu.max')?'max 100000':'max'):read(path,...args);syncBuiltinESMExports();");
	const common = `/** @jest-environment node */\nconst fs=require('node:fs');jest.setTimeout(15000);const file=${JSON.stringify(eventsPath)};const events=()=>fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse):[];const record=kind=>fs.appendFileSync(file,JSON.stringify({kind,name:NAME,time:Date.now(),pid:process.pid})+'\\n');const wait=async predicate=>{const deadline=Date.now()+10000;while(!predicate()){if(Date.now()>deadline)throw new Error('Runner fixture ordering timed out');await new Promise(r=>setTimeout(r,10));}};`;
	for (const name of ["ordinary-one", "ordinary-two"]) writeFileSync(join(directory, `${name}.test.cjs`), common.replaceAll("NAME", JSON.stringify(name)) + "test('ordinary fixture',async()=>{record('start');await wait(()=>events().filter(e=>e.kind==='start'&&e.name.startsWith('ordinary')).length===2);await new Promise(r=>setTimeout(r,100));record('end');});");
	writeFileSync(join(directory, "runtime-boundaries.test.cjs"), common.replaceAll("NAME", "'quiet'") + "test('quiet fixture',async()=>{record('start');await wait(()=>events().some(e=>e.kind==='start'&&e.name.startsWith('ordinary')));await new Promise(r=>setTimeout(r,100));record('end');});");
	try {
		const run = spawnSync(process.execPath, ["node_modules/jest/bin/jest.js", directory, "--roots", directory, "--testMatch=**/*.test.cjs", "--testSequencer", sorter, "--maxWorkers=2", "--json", "--outputFile", resultPath], { encoding: "utf8", timeout: 45000, env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(preload).href}` } });
		if (run.error) throw run.error;
		expect(run.status).toBe(0);
		const result = JSON.parse(readFileSync(resultPath, "utf8"));
		expect(result.numPassedTests).toBe(3);
		expect(result.numPendingTests).toBe(0);
		const events = readFileSync(eventsPath, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		const interval = (name: string) => ({ start: events.find((e) => e.name === name && e.kind === "start").time, end: events.find((e) => e.name === name && e.kind === "end").time });
		const first = interval("ordinary-one"),
			second = interval("ordinary-two"),
			quiet = interval("quiet");
		expect(Math.max(first.start, second.start)).toBeLessThan(Math.min(first.end, second.end));
		expect(quiet.start).toBeGreaterThanOrEqual(Math.max(first.end, second.end));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 50000);
