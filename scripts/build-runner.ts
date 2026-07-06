import { build } from "esbuild";
import { execSync } from "child_process";

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getBaseUrl } from "../src/app/actions/utils";

async function main() {
	// 1. Calculate the correct Prod/Preview URL dynamically during build
	const baseUrl = (await getBaseUrl()).toString().replace(/\/$/, "");
	console.log(`[Builder] Baking API URL into runner: ${baseUrl}`);

	// 2. Bundle the runner and inject the URL as a constant
	await build({
		entryPoints: ["src/runner/index.ts"],
		bundle: true,
		platform: "node",
		outfile: "build/runner.js",
		define: {
			"process.env.BAKED_API_URL": JSON.stringify(baseUrl),
		},
	});

	console.log(`[Builder] Bundled successfully. Compiling executable with pkg...`);

	// 3. Compile binaries using pkg
	execSync("npx pkg build/runner.js --no-bytecode --public -t node18-win-x64,node18-linux-x64 --out-path build/", { stdio: "inherit" });

	console.log(`[Builder] Runner executables generated successfully in build/!`);
}

main().catch(console.error);
