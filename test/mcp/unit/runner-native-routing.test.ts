/** @jest-environment node */
import { execFileSync } from "node:child_process";

test("normal browser entry points exclude native workflow files while their native owner retains them", () => {
	const code = `
import browser from './playwright.config.ts';
import native from './playwright.mcp.config.ts';
import mm from 'micromatch';
const observation=['bdd-chromium','atdd-chromium'].map(name=>{
 const group=name.startsWith('bdd')?'bdd':'atdd';
 const workflow='.features-gen/'+group+'/mcp-workflows/runner-free-pro.feature.spec.js';
 const genuine='.features-gen/'+group+'/runner-standby.feature.spec.js';
 const b=browser.projects.find(project=>project.name===name);
 const n=native.projects.find(project=>project.name===name);
 const ignored=(project,file)=>mm([file],project.testIgnore??[],{dot:true}).length>0;
 return {name,browserIgnoresWorkflow:ignored(b,workflow),browserIgnoresGenuine:ignored(b,genuine),nativeIgnoresWorkflow:ignored(n,workflow)};
});
process.stdout.write(JSON.stringify(observation));
`;
	const result = JSON.parse(execFileSync("bun", ["--eval", code], { encoding: "utf8", timeout: 20000 }));
	expect(result).toEqual(["bdd-chromium", "atdd-chromium"].map((name) => ({ name, browserIgnoresWorkflow: true, browserIgnoresGenuine: false, nativeIgnoresWorkflow: false })));
});

test("TDD-US1-ROUTE001: native acceptance has one owner and incomplete or duplicate execution inventories fail", () => {
	// This is collection metadata, never a substitute for the actual acceptance journey.
	const code = `
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
let mode='complete';
const bdd={id:'native-bdd',tests:[{projectName:'bdd-chromium'}]};
const atdd={id:'ATDD-US1-SC001',tests:[{projectName:'atdd-chromium'}]};
childProcess.execFileSync=(_command,args)=>{
 const selected=args.filter(value=>value.startsWith('--project=')).map(value=>value.slice('--project='.length));
 const specs=(mode==='missing'?[]:mode==='duplicate'?[bdd,bdd]:mode==='duplicate-project'?[bdd,{...bdd,tests:atdd.tests}]:mode==='unidentified'?[{...bdd,id:undefined}]:[bdd,atdd]).filter(spec=>selected.includes(spec.tests[0].projectName));
 return JSON.stringify({suites:[{specs}]});
};
syncBuiltinESMExports();
const {workflowInventory,combinedWorkflowInventory}=await import('./scripts/run-mcp-workflow-coverage.mjs');
const native=workflowInventory();
mode='missing';let missingRejected=false;try{workflowInventory();}catch{missingRejected=true;}
mode='duplicate';let duplicateRejected=false;try{workflowInventory();}catch{duplicateRejected=true;}
mode='duplicate-project';let crossProjectRejected=false;try{workflowInventory();}catch{crossProjectRejected=true;}
mode='unidentified';let unidentifiedRejected=false;try{workflowInventory();}catch{unidentifiedRejected=true;}
const split=combinedWorkflowInventory([{suites:[{specs:[bdd]}]},{suites:[{specs:[atdd]}]}]);
let splitDuplicateRejected=false;try{combinedWorkflowInventory([{suites:[{specs:[bdd]}]},{suites:[{specs:[bdd]}]}]);}catch{splitDuplicateRejected=true;}
const {selectBrowserFiles}=await import('./scripts/test-execution.cjs');
const browserFiles=selectBrowserFiles([
 '.features-gen/bdd/mcp-workflows/runner-free-pro.feature.spec.js',
 '.features-gen/atdd/mcp-workflows/runner-free-pro.feature.spec.js',
 '.features-gen/atdd/account.feature.spec.js'
],0,1);
process.stdout.write(JSON.stringify({native,missingRejected,duplicateRejected,crossProjectRejected,unidentifiedRejected,split,splitDuplicateRejected,browserFiles}));
`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8", timeout: 20000 }));
	expect(result).toEqual({
		native: ["ATDD-US1-SC001:atdd-chromium", "native-bdd:bdd-chromium"],
		missingRejected: true,
		duplicateRejected: true,
		crossProjectRejected: true,
		unidentifiedRejected: true,
		split: ["ATDD-US1-SC001:atdd-chromium", "native-bdd:bdd-chromium"],
		splitDuplicateRejected: true,
		browserFiles: [".features-gen/atdd/account.feature.spec.js"],
	});
});

test("real-media workflows run serially with one infrastructure retry", () => {
	const code = `
import {workflowExecutionCommands} from './scripts/run-mcp-workflow-coverage.mjs';
process.stdout.write(JSON.stringify(workflowExecutionCommands(4,'playwright')));
`;
	const [parallel, serial] = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8", timeout: 20000 }));
	expect(parallel).toContain("--workers=4");
	expect(parallel).toContain("--grep-invert");
	expect(parallel).not.toContain("--retries=1");
	expect(serial).toContain("--workers=1");
	expect(serial).toContain("--grep");
	expect(serial).toContain("--retries=1");
});
