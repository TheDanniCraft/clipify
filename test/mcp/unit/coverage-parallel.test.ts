/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

let result: any;
describe("per-suite parallel native coverage isolation", () => {
	beforeAll(() => {
		mkdirSync("test-results/mcp", { recursive: true });
		const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/parallel-collector-"));
		const code = `import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn} from 'node:child_process';import {buildMcpCoverageProbes} from './scripts/build-mcp-coverage-probes.mjs';import Reporter from './scripts/mcp-coverage-reporter.cjs';
const directory=process.argv[1],raw=directory+'/raw';fs.mkdirSync(raw,{recursive:true});await buildMcpCoverageProbes({outputDirectory:directory+'/probes'});
const suites=[path.resolve('test/mcp/parallel-read.test.ts'),path.resolve('test/mcp/parallel-update.test.ts')];
const folders=suites.map(s=>path.join(raw,crypto.createHash('sha256').update(s).digest('hex')));for(const folder of folders)fs.mkdirSync(folder);
const modes=['resources:overlay-get','resources:overlay-update'];
const calls=await Promise.all(modes.map((mode,index)=>new Promise((resolve,reject)=>{let out='';const child=spawn(process.execPath,['--conditions=react-server',directory+'/probes/flow-probe.mjs',mode],{env:{...process.env,NODE_V8_COVERAGE:folders[index]},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>out+=b);child.stderr.resume();child.on('error',reject);child.on('close',code=>code===0?resolve(JSON.parse(out.trim().split('\\n').at(-1))):reject(new Error('Native parallel probe exited '+code)));})));
const reporter=new Reporter({collectCoverage:true},{rawDirectory:raw,outputDirectory:directory+'/reports'});
const first={coverage:{},testFilePath:suites[0]},second={coverage:{},testFilePath:suites[1]};await reporter.onTestResult({path:suites[0]},first);
const secondFilesPreserved=fs.readdirSync(folders[1]).filter(f=>f.startsWith('coverage-')).length>0;
await reporter.onTestResult({path:suites[1]},second);
function counters(result){const f=Object.entries(result.coverage).find(([p])=>p.endsWith('/resources/overlays.ts'))?.[1];if(!f)return null;const text=fs.readFileSync('src/server/resources/overlays.ts','utf8').split('\\n');const count=name=>{const line=text.findIndex(l=>l.startsWith('export async function '+name+'('))+1;const id=Object.keys(f.fnMap).find(id=>f.fnMap[id].loc.start.line===line);return id===undefined?null:f.f[id];};return {get:count('getOverlay'),update:count('updateOverlay')};}
process.stdout.write(JSON.stringify({statuses:calls.map(c=>c.protocolStatus),first:counters(first),second:counters(second),secondFilesPreserved,error:reporter.getLastError()?.message}));`;
		try {
			result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, directory], { encoding: "utf8", timeout: 45000 }));
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	test("separate simultaneous reads and updates retain their own executed and cold functions", () => {
		expect(result.statuses).toEqual([200, 200]);
		expect(result.first?.get).toBeGreaterThan(0);
		expect(result.first?.update).toBe(0);
		expect(result.second?.update).toBeGreaterThan(0);
	});
	test("collecting one suite does not consume or delete another suite's raw files", () => {
		expect(result.secondFilesPreserved).toBe(true);
		expect(result.error).toBeUndefined();
	});
});
