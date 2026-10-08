/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
let result: any;
describe("real Node child coverage bridge", () => {
	beforeAll(() => {
		mkdirSync("test-results/mcp", { recursive: true });
		const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/collector-check-"));
		const code = `import fs from "node:fs";import{execFileSync}from"node:child_process";import coverage from"istanbul-lib-coverage";
  let build,Reporter;try{build=(await import('./scripts/build-mcp-coverage-probes.mjs')).buildMcpCoverageProbes;Reporter=(await import('./scripts/mcp-coverage-reporter.cjs')).default;}catch{}
  if(!build||!Reporter){process.stdout.write(JSON.stringify({missing:true}));}else{
   const directory=process.argv[1],raw=directory+'/raw';fs.mkdirSync(raw,{recursive:true});await build({outputDirectory:directory+'/probes'});
   const output=execFileSync(process.execPath,['--conditions=react-server',directory+'/probes/flow-probe.mjs','resources:playlist-add'],{encoding:'utf8',timeout:30000,env:{...process.env,NODE_V8_COVERAGE:raw}});
   const call=JSON.parse(output.trim().split('\\n').at(-1));const testResult={coverage:{}};
   const reporter=new Reporter({collectCoverage:true},{rawDirectory:raw,outputDirectory:directory+'/reports'});await reporter.onTestResult({},testResult);
   const names=Object.keys(testResult.coverage),permission=names.find(path=>path.endsWith('/src/server/mcp/permissions.ts')),playlist=names.find(path=>path.endsWith('/src/server/resources/playlists.ts'));
   const file=playlist?testResult.coverage[playlist]:undefined;const cold=file?Object.keys(file.fnMap).find(id=>file.fnMap[id].loc.start.line===fs.readFileSync('src/server/resources/playlists.ts','utf8').split('\\n').findIndex(line=>line.startsWith('export async function deletePlaylist('))+1):undefined;
   process.stdout.write(JSON.stringify({callSucceeded:call.resourceResult?.playlist?.configurationRevision===2,names,permission:permission?coverage.createFileCoverage(testResult.coverage[permission]).toSummary().toJSON():null,coldCounter:cold!==undefined?file.f[cold]:null,error:reporter.getLastError()?.message}));
  }`;
		try {
			result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, directory], { encoding: "utf8", timeout: 45000 }));
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	test("collects real executed backend source from the Node OAuth/credential/MCP probe", () => {
		expect(result.callSucceeded).toBe(true);
		expect(result.names).toEqual(expect.arrayContaining([expect.stringMatching(/src\/server\/resources\/playlists\.ts$/), expect.stringMatching(/src\/auth\/mcp-principal\.ts$/)]));
		expect(result.error).toBeUndefined();
	});
	test("generated CommonJS export-analysis code cannot lower real permission-map coverage", () => {
		expect(result.permission?.lines.pct).toBe(100);
	});
	test("an unexecuted real mutation stays uncovered", () => {
		expect(result.coldCounter).toBe(0);
	});
});
