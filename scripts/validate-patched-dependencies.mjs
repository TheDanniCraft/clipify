import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packageRoot = resolve(process.argv[2] ?? ".");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const patchedDependencies = packageJson.patchedDependencies ?? {};

for (const [specifier, patchFile] of Object.entries(patchedDependencies)) {
	const versionSeparator = specifier.lastIndexOf("@");
	if (versionSeparator <= 0) throw new Error(`Invalid patched dependency specifier: ${specifier}`);

	const packageName = specifier.slice(0, versionSeparator);
	const expectedVersion = specifier.slice(versionSeparator + 1);
	const patchPath = resolve(packageRoot, patchFile);
	if (!existsSync(patchPath)) throw new Error(`Missing patch for ${specifier}: ${patchFile}`);

	const installedPackageJson = join(packageRoot, "node_modules", ...packageName.split("/"), "package.json");
	if (!existsSync(installedPackageJson)) throw new Error(`Patched dependency is not installed: ${packageName}`);

	const actualVersion = JSON.parse(readFileSync(installedPackageJson, "utf8")).version;
	if (actualVersion !== expectedVersion) {
		throw new Error(`Patch version mismatch for ${packageName}: patch targets ${expectedVersion}, installed ${actualVersion}`);
	}
}

console.log(`Verified ${Object.keys(patchedDependencies).length} patched dependencies in ${packageRoot}`);
