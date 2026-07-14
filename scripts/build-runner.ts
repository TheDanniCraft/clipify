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
		external: ["@napi-rs/keyring"],
		loader: { ".node": "file" },
		define: {
			"process.env.BAKED_API_URL": JSON.stringify(bakedApiUrl),
		},
	});

	console.log(`[Builder] Bundled successfully. Compiling executables with @yao-pkg/pkg...`);
	const ldidPath = getLdidPath();
	const pkgEnv = { ...process.env };
	if (ldidPath) {
		const ldidDir = path.dirname(ldidPath);
		pkgEnv.PATH = `${ldidDir}${path.delimiter}${pkgEnv.PATH || ""}`;
		console.log(`[Builder] macOS ad-hoc signing available via ldid: ${ldidPath}`);
	} else {
		console.warn(`[Builder] macOS ad-hoc signing skipped; build in Docker for signed macOS artifacts.`);
	}

	// 3. Compile binaries using @yao-pkg/pkg
	const pkgBin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "pkg.cmd" : "pkg");
	if (!fs.existsSync(pkgBin)) throw new Error(`@yao-pkg/pkg executable not found at ${pkgBin}`);
	const pkgTargets = process.env.RUNNER_PKG_TARGETS ?? "node22-win-x64,node22-linux-x64,node22-linux-arm64,node22-macos-x64,node22-macos-arm64";
	console.log(`[Builder] Packaging targets: ${pkgTargets}`);
	execFileSync(pkgBin, ["build/runner.js", "-t", pkgTargets, "--out-path", "build/"], { stdio: "inherit", env: pkgEnv });

	console.log(`[Builder] Runner executables generated successfully in build/!`);

	// 4. Move binaries to public/downloads/runner/ and calculate hashes
	const downloadsDir = path.join(process.cwd(), "public", "downloads", "runner");
	if (!fs.existsSync(downloadsDir)) {
		fs.mkdirSync(downloadsDir, { recursive: true });
	}

	const requestedTargets = new Set(pkgTargets.split(",").map((target) => target.trim()));
	const findGeneratedBinary = (target: string, ...names: string[]) => (requestedTargets.has(target) ? names.map((name) => path.join(process.cwd(), "build", name)).find((candidate) => fs.existsSync(candidate)) : undefined);
	const winBinarySrc = findGeneratedBinary("node22-win-x64", "runner-win-x64.exe", "runner-win.exe", "runner.exe");
	const linuxBinarySrc = findGeneratedBinary("node22-linux-x64", "runner-linux-x64", "runner-linux", "runner");
	const linuxArmBinarySrc = findGeneratedBinary("node22-linux-arm64", "runner-linux-arm64", "runner-linux", "runner");
	const macosX64BinarySrc = findGeneratedBinary("node22-macos-x64", "runner-macos-x64", "runner-macos", "runner");
	const macosArmBinarySrc = findGeneratedBinary("node22-macos-arm64", "runner-macos-arm64", "runner-macos", "runner");

	const winBinaryDest = path.join(downloadsDir, "clipify-runner-windows.exe");
	const linuxBinaryDest = path.join(downloadsDir, "clipify-runner-linux");
	const linuxArmBinaryDest = path.join(downloadsDir, "clipify-runner-linux-arm64");
	const macosX64BinaryDest = path.join(downloadsDir, "clipify-runner-macos");
	const macosArmBinaryDest = path.join(downloadsDir, "clipify-runner-macos-arm64");

	if (winBinarySrc) {
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
	if (linuxBinarySrc) fs.copyFileSync(linuxBinarySrc, linuxBinaryDest);
	if (linuxArmBinarySrc) fs.copyFileSync(linuxArmBinarySrc, linuxArmBinaryDest);
	if (macosX64BinarySrc) fs.copyFileSync(macosX64BinarySrc, macosX64BinaryDest);
	if (macosArmBinarySrc) fs.copyFileSync(macosArmBinarySrc, macosArmBinaryDest);

	const hashes = {
		windows: fs.existsSync(winBinaryDest) ? getFileHash(winBinaryDest) : null,
		linux: fs.existsSync(linuxBinaryDest) ? getFileHash(linuxBinaryDest) : null,
		linuxArm: fs.existsSync(linuxArmBinaryDest) ? getFileHash(linuxArmBinaryDest) : null,
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
