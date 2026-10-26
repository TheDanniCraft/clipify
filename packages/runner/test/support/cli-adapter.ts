import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformSync } from "esbuild";

type FixtureModule = { exports: unknown };

/** Run real CLI helpers without interactive startup; coverage retains original source/counter identity. */
export async function compileRunnerCli(adaptedSource: string, dependency: (name: string) => unknown, target: FixtureModule, options: { coverage?: boolean } = {}) {
	const sourcePath = resolve(__dirname, "../../src/index.ts"),
		original = readFileSync(sourcePath, "utf8");
	const entry = "main().catch(console.error);",
		entryOffset = original.indexOf(entry);
	if (entryOffset < 0 || adaptedSource.slice(0, entryOffset) !== original.slice(0, entryOffset)) throw new Error("CLI fixture must preserve the production source prefix");
	const coverage = options.coverage ?? process.argv.some((argument) => /^--coverage(?:=true)?$/.test(argument));
	let code: string;
	if (coverage) {
		const { readConfig } = await import("jest-config");
		const { createScriptTransformer } = await import("@jest/transform");
		const { projectConfig } = await readConfig({ _: [], $0: "runner-cli-coverage" }, resolve(__dirname, "../.."));
		const transformer = await createScriptTransformer(projectConfig);
		code = transformer.transformSource(sourcePath, original, { instrument: true, supportsStaticESM: false, supportsDynamicImport: false, supportsExportNamespaceFrom: false, supportsTopLevelAwait: false }).code;
	} else code = transformSync(original, { loader: "ts", format: "cjs", target: "node24", sourcefile: sourcePath }).code;
	if ((code.match(/^[ \t]*main\(\)\.catch\(console\.error\);[ \t]*$/gm) ?? []).length !== 1) throw new Error("CLI startup adapter is ambiguous");
	const entryCounterId = code.match(/^[ \t]*cov_[A-Za-z0-9_]+\(\)\.s\[(\d+)\]\+\+;[ \t]*\r?\n[ \t]*main\(\)\.catch\(console\.error\);[ \t]*$/m)?.[1] ?? null;
	// Keep the original entrypoint counter present but unexecuted. Helper fixtures do not prove startup.
	code = code.replace(/^(?:[ \t]*cov_[A-Za-z0-9_]+\(\)\.s\[\d+\]\+\+;[ \t]*\r?\n)?[ \t]*main\(\)\.catch\(console\.error\);[ \t]*$/m, "");
	const names = Array.from(original.matchAll(/^(?:async )?function (\w+)\(/gm), (match) => match[1]);
	names.push("RunnerConfigurationError", "actualStates", "activeEngines", "freeControllers");
	code += "\nObject.assign(module.exports,{" + names.join(",") + "});module.exports.watchdog=startExecutionWatchdog;\n";
	new Function("require", "module", "exports", code)(dependency, target, target.exports);
	return { entryCounterId };
}
