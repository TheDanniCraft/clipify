import { build } from "esbuild";
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as resedit from "resedit";

import { resolveBaseUrl } from "../src/app/lib/baseUrl";

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

function getFileHash(filePath: string): string {
	const fileBuffer = fs.readFileSync(filePath);
	const hashSum = crypto.createHash("sha256");
	hashSum.update(fileBuffer);
	return hashSum.digest("hex");
}

function getLdidPath(): string | null {
	try {
		return execSync("command -v ldid", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
	} catch {
		return null;
	}
}

async function main() {
	const bakedApiUrl = (process.env.CLIPIFY_RUNNER_API_URL ? new URL(process.env.CLIPIFY_RUNNER_API_URL) : resolveBaseUrl()).toString().replace(/\/$/, "");
	console.log(`[Builder] Baking runner API URL: ${bakedApiUrl}`);

	// 2. Bundle the runner and inject the URL as a constant
	await build({
		entryPoints: ["src/runner/index.ts"],
		bundle: true,
		platform: "node",
		outfile: "build/runner.js",
		loader: { ".node": "file" },
		define: {
			"process.env.BAKED_API_URL": JSON.stringify(bakedApiUrl),
		},
	});

	console.log(`[Builder] Bundled successfully. Compiling executable with pkg...`);
	const ldidPath = getLdidPath();
	const pkgEnv = { ...process.env };
	if (ldidPath) {
		const ldidDir = path.dirname(ldidPath);
		pkgEnv.PATH = `${ldidDir}${path.delimiter}${pkgEnv.PATH || ""}`;
		console.log(`[Builder] macOS ad-hoc signing available via ldid: ${ldidPath}`);
	} else {
		console.warn(`[Builder] macOS ad-hoc signing skipped; build in Docker for signed macOS artifacts.`);
	}

	// 3. Compile binaries using pkg
	const pkgBin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "pkg.cmd" : "pkg");
	if (!fs.existsSync(pkgBin)) throw new Error(`pkg executable not found at ${pkgBin}`);
	const pkgTargets = process.env.RUNNER_PKG_TARGETS ?? "node18-win-x64,node18-linux-x64,node18-macos-x64,node18-macos-arm64";
	console.log(`[Builder] Packaging targets: ${pkgTargets}`);
	execFileSync(pkgBin, ["build/runner.js", "-t", pkgTargets, "--out-path", "build/"], { stdio: "inherit", env: pkgEnv });

	console.log(`[Builder] Runner executables generated successfully in build/!`);

	// 4. Move binaries to public/downloads/runner/ and calculate hashes
	const downloadsDir = path.join(process.cwd(), "public", "downloads", "runner");
	if (!fs.existsSync(downloadsDir)) {
		fs.mkdirSync(downloadsDir, { recursive: true });
	}

	const winBinarySrc = path.join(process.cwd(), "build", "runner-win-x64.exe");
	const linuxBinarySrc = path.join(process.cwd(), "build", "runner-linux-x64");
	const macosX64BinarySrc = path.join(process.cwd(), "build", "runner-macos-x64");
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
					iconFile.icons.map((i) => i.data),
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
