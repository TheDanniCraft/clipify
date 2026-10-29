import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function requireRuntime(directory) {
	for (const path of ["BUILD_ID", "server", "static"]) if (!existsSync(join(directory, path))) throw Error(`Incomplete browser build: missing ${path}`);
}

export function packBrowserBuild(source, archive) {
	requireRuntime(source);
	// Compilation caches are not runtime inputs; retain every other build file.
	execFileSync("tar", ["--exclude=./cache", "--exclude=./standalone", "-I", "gzip -1", "-cf", resolve(archive), "-C", resolve(source), "."]);
	return statSync(archive).size;
}

export function unpackBrowserBuild(archive, directory) {
	mkdirSync(directory, { recursive: true });
	execFileSync("tar", ["-xzf", resolve(archive), "-C", resolve(directory)]);
	requireRuntime(directory);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [mode, source, target] = process.argv.slice(2);
	if (!source || !target || !["pack", "unpack"].includes(mode)) throw Error("Usage: browser-build-artifact.mjs pack|unpack source target");
	if (mode === "pack") console.log(`Packed browser runtime: ${packBrowserBuild(source, target)} bytes; build caches excluded.`);
	else unpackBrowserBuild(source, target);
}
