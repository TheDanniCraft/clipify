/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

test("bundled public Next entries retain resolvable installed framework imports", () => {
	const directory = mkdtempSync(join(process.cwd(), "test-results/mcp/next-import-check-"));
	try {
		const code = `import fs from 'node:fs';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import{buildMcpCoverageProbes}from'./scripts/build-mcp-coverage-probes.mjs';await buildMcpCoverageProbes({outputDirectory:process.argv[1]});const imports=new Set();for(const name of ['browser-playlist-delete-probe.mjs','websocket-runtime-probe.mjs']){const text=fs.readFileSync(process.argv[1]+'/'+name,'utf8');for(const match of text.matchAll(/(?:from\\s*|import\\s*\\()\\s*["']([^"']+)["']/g))imports.add(match[1]);}const missing=[...imports].filter(spec=>{try{const resolved=import.meta.resolve(spec);return !resolved.startsWith('node:')&&!fs.statSync(fileURLToPath(resolved)).isFile();}catch{return true;}});const turnstile=[...imports].find(spec=>spec==='nextjs-turnstile'||spec.endsWith('/nextjs-turnstile/dist/index.js'));let serverModuleLoaded=false;try{serverModuleLoaded=execFileSync(process.execPath,['--conditions=react-server','--input-type=module','--eval',"const module=await import(process.argv[1]);process.stdout.write(typeof module.verifyTurnstile);",turnstile],{encoding:'utf8',timeout:10000})==='function';}catch{}process.stdout.write(JSON.stringify({count:imports.size,missing,serverModuleLoaded}));`;
		const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, directory], { encoding: "utf8", timeout: 45000 }));
		expect(result.count).toBeGreaterThan(0);
		expect(result.missing).toEqual([]);
		expect(result.serverModuleLoaded).toBe(true);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
