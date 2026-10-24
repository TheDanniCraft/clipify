import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Keep fixture configuration as data rather than constructing executable modules. */
export function prepareNativeTestShims(directory, configuration) {
	const path = join(directory, "native-test-runtime.json");
	writeFileSync(path, JSON.stringify(configuration), { mode: 0o600 });
	process.env.CLIPIFY_NATIVE_TEST_RUNTIME = path;
	return {
		dependencies: fileURLToPath(new URL("./native-dependencies-shim.mjs", import.meta.url)),
		os: fileURLToPath(new URL("./native-os-shim.mjs", import.meta.url)),
	};
}

export function readNativeTestRuntime() {
	const path = process.env.CLIPIFY_NATIVE_TEST_RUNTIME;
	if (!path) throw new Error("Native fixture runtime configuration is missing");
	const configuration = JSON.parse(readFileSync(path, "utf8"));
	for (const key of ["chromePath", "ffmpegPath", "home"]) {
		if (typeof configuration[key] !== "string" || !configuration[key]) throw new Error("Native fixture runtime configuration is invalid");
	}
	return configuration;
}
