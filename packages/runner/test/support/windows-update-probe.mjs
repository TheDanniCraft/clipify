// Run on Windows CI: exercise the actual PowerShell handoff, locked executable,
// restart arguments, original filename and old-version cleanup.
import { build } from "esbuild";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";

if (process.platform !== "win32") throw new Error("Windows updater probe requires Windows");
const directory = await mkdtemp(join(tmpdir(), "clipify update "));
const original = join(directory, "runner.exe");
const staged = join(directory, "runner.new.exe");
const old = `${original}.old`;
const marker = join(directory, "restart.json");
const updater = join(directory, "updater.mjs");
const worker = join(directory, "handoff.mjs");
const resumed = join(directory, "resumed.mjs");
try {
	await build({ entryPoints: [resolve("src/updater.ts")], outfile: updater, bundle: true, platform: "node", format: "esm", packages: "external" });
	await copyFile(process.execPath, original);
	await copyFile(process.execPath, staged);
	await writeFile(
		resumed,
		`
    import {writeFileSync} from 'node:fs';
    try {
      const {cleanupOldVersions} = await import(${JSON.stringify(pathToFileURL(updater).href)});
      process.pkg = {};
      await cleanupOldVersions();
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({path:process.execPath,args:process.argv.slice(2)}));
    } catch(error) {
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({error:String(error.stack ?? error)}));
    }
  `,
	);
	await writeFile(
		worker,
		`
    import {launchWindowsUpdateHelper} from ${JSON.stringify(pathToFileURL(updater).href)};
    await launchWindowsUpdateHelper(${JSON.stringify(original)},${JSON.stringify(staged)},${JSON.stringify(old)},${JSON.stringify([resumed, "--name", 'runner "one" with spaces'])},process.pid);
  `,
	);
	const child = spawn(original, [worker], { stdio: "inherit" });
	const [code] = await once(child, "exit");
	assert.equal(code, 0, "handoff process must exit successfully");
	const deadline = Date.now() + 65000;
	let result;
	while (Date.now() < deadline) {
		try {
			result = JSON.parse(await readFile(marker, "utf8"));
			break;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
	if (!result) {
		console.error("Update probe files:", await readdir(directory));
		console.error("PowerShell failure:", await readFile(`${original}.update-error.log`, "utf8").catch(() => "No helper error log"));
	}
	assert.ok(result, "replacement must restart and report its arguments");
	assert.equal(result.error, undefined, `Replacement startup failed: ${result.error}`);
	assert.equal(result.path.toLowerCase(), original.toLowerCase());
	assert.deepEqual(result.args, ["--name", 'runner "one" with spaces']);
	await access(original);
	await assert.rejects(access(staged), { code: "ENOENT" });
	await assert.rejects(access(old), { code: "ENOENT" });
	console.log("Windows update handoff, restart and cleanup passed");
} finally {
	await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
}
