import { build } from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getBaseUrl } from "../src/app/actions/utils";

function getFileHash(filePath: string): string {
	const fileBuffer = fs.readFileSync(filePath);
	const hashSum = crypto.createHash("sha256");
	hashSum.update(fileBuffer);
	return hashSum.digest("hex");
}

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
		external: ["puppeteer-stream", "puppeteer-core", "puppeteer"],
		define: {
			"process.env.BAKED_API_URL": JSON.stringify(baseUrl),
		},
	});

	console.log(`[Builder] Bundled successfully. Compiling executable with pkg...`);

	// 3. Compile binaries using pkg
	execSync("npx pkg build/runner.js --public -t node18-win-x64,node18-linux-x64 --out-path build/", { stdio: "inherit" });

	console.log(`[Builder] Runner executables generated successfully in build/!`);

	// 4. Move binaries to public/downloads/runner/ and calculate hashes
	const downloadsDir = path.join(process.cwd(), "public", "downloads", "runner");
	if (!fs.existsSync(downloadsDir)) {
		fs.mkdirSync(downloadsDir, { recursive: true });
	}

	const winBinarySrc = path.join(process.cwd(), "build", "runner-win.exe");
	const linuxBinarySrc = path.join(process.cwd(), "build", "runner-linux");

	const winBinaryDest = path.join(downloadsDir, "clipify-runner-windows.exe");
	const linuxBinaryDest = path.join(downloadsDir, "clipify-runner-linux");

	if (fs.existsSync(winBinarySrc)) fs.copyFileSync(winBinarySrc, winBinaryDest);
	if (fs.existsSync(linuxBinarySrc)) fs.copyFileSync(linuxBinarySrc, linuxBinaryDest);

	const hashes = {
		windows: fs.existsSync(winBinaryDest) ? getFileHash(winBinaryDest) : null,
		linux: fs.existsSync(linuxBinaryDest) ? getFileHash(linuxBinaryDest) : null,
		updatedAt: new Date().toISOString(),
	};

	fs.writeFileSync(path.join(downloadsDir, "version.json"), JSON.stringify(hashes, null, 2));
	console.log(`[Builder] Copied binaries to public/downloads/runner/`);
	console.log(`[Builder] Hashes generated:`, hashes);
}

main().catch(console.error);
