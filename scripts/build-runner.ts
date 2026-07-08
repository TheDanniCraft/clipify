import { build } from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as resedit from "resedit";

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());


function getFileHash(filePath: string): string {
	const fileBuffer = fs.readFileSync(filePath);
	const hashSum = crypto.createHash("sha256");
	hashSum.update(fileBuffer);
	return hashSum.digest("hex");
}

async function main() {

	// 2. Bundle the runner and inject the URL as a constant
	await build({
		entryPoints: ["src/runner/index.ts"],
		bundle: true,
		platform: "node",
		outfile: "build/runner.js",
		external: ["puppeteer-stream", "puppeteer-core", "puppeteer", "@napi-rs/keyring"],
		define: {},
	});

	console.log(`[Builder] Bundled successfully. Compiling executable with pkg...`);

	// 3. Compile binaries using pkg
	execSync("npx pkg build/runner.js --public -t node18-win-x64,node18-linux-x64,node18-macos-x64,node18-macos-arm64 --out-path build/", { stdio: "inherit" });

	console.log(`[Builder] Runner executables generated successfully in build/!`);

	// 4. Move binaries to public/downloads/runner/ and calculate hashes
	const downloadsDir = path.join(process.cwd(), "public", "downloads", "runner");
	if (!fs.existsSync(downloadsDir)) {
		fs.mkdirSync(downloadsDir, { recursive: true });
	}

	const winBinarySrc = path.join(process.cwd(), "build", "runner-win.exe");
	const linuxBinarySrc = path.join(process.cwd(), "build", "runner-linux");
	const macosX64BinarySrc = path.join(process.cwd(), "build", "runner-macos");
	const macosArmBinarySrc = path.join(process.cwd(), "build", "runner-macos-arm64");

	const winBinaryDest = path.join(downloadsDir, "clipify-runner-windows.exe");
	const linuxBinaryDest = path.join(downloadsDir, "clipify-runner-linux");
	const macosX64BinaryDest = path.join(downloadsDir, "clipify-runner-macos");
	const macosArmBinaryDest = path.join(downloadsDir, "clipify-runner-macos-arm64");

	if (fs.existsSync(winBinarySrc)) {
		fs.copyFileSync(winBinarySrc, winBinaryDest);
		try {
			console.log(`[Builder] Setting executable icon...`);
			const exeData = fs.readFileSync(winBinaryDest);
			const exe = resedit.NtExecutable.from(exeData);
			const res = resedit.NtExecutableResource.from(exe);
			const iconPath = path.join(process.cwd(), "src/app/favicon.ico");
			if (fs.existsSync(iconPath)) {
				const iconFile = resedit.Data.IconFile.from(fs.readFileSync(iconPath));
				resedit.Resource.IconGroupEntry.replaceIconsForResource(
					res.entries,
					1,
					1033,
					iconFile.icons.map(i => i.data)
				);
				res.outputResource(exe);
				fs.writeFileSync(winBinaryDest, Buffer.from(exe.generate()));
			}
		} catch (e) {
			console.warn(`[Builder] Failed to set executable icon:`, e);
		}
	}
	if (fs.existsSync(linuxBinarySrc)) fs.copyFileSync(linuxBinarySrc, linuxBinaryDest);
	if (fs.existsSync(macosX64BinarySrc)) fs.copyFileSync(macosX64BinarySrc, macosX64BinaryDest);
	if (fs.existsSync(macosArmBinarySrc)) fs.copyFileSync(macosArmBinarySrc, macosArmBinaryDest);

	const hashes = {
		windows: fs.existsSync(winBinaryDest) ? getFileHash(winBinaryDest) : null,
		linux: fs.existsSync(linuxBinaryDest) ? getFileHash(linuxBinaryDest) : null,
		macos: fs.existsSync(macosX64BinaryDest) ? getFileHash(macosX64BinaryDest) : null,
		macosArm: fs.existsSync(macosArmBinaryDest) ? getFileHash(macosArmBinaryDest) : null,
		updatedAt: new Date().toISOString(),
	};

	fs.writeFileSync(path.join(downloadsDir, "version.json"), JSON.stringify(hashes, null, 2));
	console.log(`[Builder] Copied binaries to public/downloads/runner/`);
	console.log(`[Builder] Hashes generated:`, hashes);
}

main().catch(console.error);
