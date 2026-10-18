import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";

test("TDD-US1-CON004 actual Runner bundling embeds only configured public verification keys", () => {
	const { publicKey } = generateKeyPairSync("ed25519");
	const id = createHash("sha256")
		.update(publicKey.export({ type: "spki", format: "der" }))
		.digest("hex")
		.slice(0, 16);
	const keys = { [id]: publicKey.export({ type: "spki", format: "pem" }).toString() };
	const script = `
 import {existsSync} from 'node:fs';
 if(!existsSync('./build-inputs.mjs')) console.log(JSON.stringify({keys:null}));
 else {
  const {runnerExecutionKeyDefines}=await import('./build-inputs.mjs');
  const {build}=await import('esbuild');
  const result=await build({stdin:{contents:'export const keys = process.env.BAKED_RUNNER_EXECUTION_PUBLIC_KEYS;',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',define:runnerExecutionKeyDefines(process.env.RUNNER_EXECUTION_PUBLIC_KEYS)});
  const module={exports:{}};
  new Function('module','exports',result.outputFiles[0].text)(module,module.exports);
  console.log(JSON.stringify({keys:JSON.parse(module.exports.keys),containsPrivate:result.outputFiles[0].text.includes('BEGIN PRIVATE KEY')}));
 }
 `;
	const output = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: resolve(__dirname, "../.."), encoding: "utf8", env: { ...process.env, RUNNER_EXECUTION_PUBLIC_KEYS: JSON.stringify(keys) } }));
	expect(output.keys).toEqual(keys);
	expect(output.containsPrivate).toBe(false);
});

test("TDD-US1-CON004 changing trusted keys invalidates the native artifact fingerprint", () => {
	const fingerprint = (keys: Record<string, string>) => execFileSync(process.execPath, ["scripts/fingerprint-runner.mjs", "--fingerprint"], { cwd: resolve(__dirname, "../../../.."), encoding: "utf8", env: { ...process.env, RUNNER_EXECUTION_PUBLIC_KEYS: JSON.stringify(keys) } }).trim();
	const key = () => {
		const { publicKey } = generateKeyPairSync("ed25519");
		const id = createHash("sha256")
			.update(publicKey.export({ type: "spki", format: "der" }))
			.digest("hex")
			.slice(0, 16);
		return [id, publicKey.export({ type: "spki", format: "pem" }).toString()];
	};
	const a = key(),
		b = key();
	expect(fingerprint(Object.fromEntries([a]))).not.toBe(fingerprint(Object.fromEntries([b])));
	expect(fingerprint(Object.fromEntries([a, b]))).toBe(fingerprint(Object.fromEntries([b, a])));
});
