import os from "os";
import path from "path";
import fs from "fs";
import { install, resolveBuildId, computeExecutablePath, Browser } from "@puppeteer/browsers";
import { execFileSync, execSync } from "child_process";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

const CACHE_DIR = path.join(os.homedir(), ".clipify-runner", "bin");

const MAC_FFMPEG_RELEASE = {
	x64: { file: "ffmpeg-darwin-x64.gz", sha256: "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106", binarySha256: "ebdddc936f61e14049a2d4b549a412b8a40deeff6540e58a9f2a2da9e6b18894" },
	arm64: { file: "ffmpeg-darwin-arm64.gz", sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa", binarySha256: "a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584" },
} as const;

export function getMacFfmpegRelease(arch: string) {
	if (arch !== "x64" && arch !== "arm64") throw new Error(`Unsupported macOS architecture: ${arch}`);
	const release = MAC_FFMPEG_RELEASE[arch];
	return { ...release, url: `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/${release.file}` };
}

async function isVerifiedFfmpegCache(binaryPath: string, marker: string, macMarker: string | null, macBinarySha: string | undefined) {
	if (!fs.existsSync(binaryPath)) return false;
	if (macMarker) return marker === macMarker && (await sha256File(binaryPath)) === macBinarySha;
	const match = marker.match(/^verified:([a-f0-9]{64}):([a-f0-9]{64})$/);
	return !!match && (await sha256File(binaryPath)) === match[2];
}

async function sha256File(filePath: string) {
	const hash = createHash("sha256");
	for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
	return hash.digest("hex");
}

export async function verifyArchiveChecksum(filePath: string, expectedSha: string) {
	if (!/^[a-f0-9]{64}$/.test(expectedSha) || (await sha256File(filePath)) !== expectedSha) throw new Error("FFmpeg archive checksum mismatch");
}

export async function extractVerifiedMacFfmpeg(archivePath: string, outputPath: string, archiveSha: string, binarySha: string) {
	await verifyArchiveChecksum(archivePath, archiveSha);
	await pipeline(fs.createReadStream(archivePath), createGunzip(), fs.createWriteStream(outputPath));
	await verifyArchiveChecksum(outputPath, binarySha);
	fs.chmodSync(outputPath, 0o755);
}

async function ensureChromeDependencies(): Promise<string> {
	if (!fs.existsSync(CACHE_DIR)) {
		fs.mkdirSync(CACHE_DIR, { recursive: true });
	}

	console.log(`[Downloader] Checking Chromium...`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const buildId = await resolveBuildId(Browser.CHROME, process.platform as any, "stable");

	let executablePath = await resolveExistingBrowser(buildId);

	let shouldInstallDeps = false;
	const checkCmd = (cmd: string) => {
		try {
			execSync(`which ${cmd}`, { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	};
	const isDebianOrUbuntuLike = () => {
		try {
			const osRelease = fs.readFileSync("/etc/os-release", "utf-8");
			return osRelease.includes("ID=debian") || osRelease.includes("ID=ubuntu") || osRelease.includes("ID_LIKE=debian") || osRelease.includes('ID_LIKE="debian"');
		} catch {
			return false;
		}
	};
	if (process.platform === "linux" && process.getuid?.() === 0 && checkCmd("apt-get") && isDebianOrUbuntuLike()) {
		shouldInstallDeps = true;
	}

	if (!fs.existsSync(executablePath)) {
		console.log(`[Downloader] Downloading Chromium (${buildId}). This may take a minute...`);
		try {
			const installed = await install({
				browser: Browser.CHROME,
				buildId,
				cacheDir: CACHE_DIR,
				installDeps: shouldInstallDeps,
			});
			executablePath = installed.executablePath;
			console.log(`[Downloader] Chromium downloaded to ${executablePath}`);
		} catch (err) {
			if (shouldInstallDeps) {
				console.warn(`[Downloader] Warning: Puppeteer installDeps failed. Continuing to manual verification...`, err);
				executablePath = await resolveExistingBrowser(buildId);
				if (!fs.existsSync(executablePath)) {
					throw err;
				}
			} else {
				throw err;
			}
		}
	} else {
		// Just resolve where it should be
		executablePath = await resolveExistingBrowser(buildId);
		console.log(`[Downloader] Chromium is ready.`);
	}

	try {
		fs.chmodSync(executablePath, 0o755);
	} catch (err) {
		console.warn(`[Downloader] Warning: Could not chmod Chrome binary:`, err);
	}

	if (process.platform === "linux") {
		try {
			console.log(`[Downloader] Verifying Linux Chrome dependencies...`);
			const lddOutput = execSync(`ldd "${executablePath}"`).toString();
			const missingDeps = lddOutput
				.split("\n")
				.filter((line) => line.includes("not found"))
				.map((line) => line.trim().split(" ")[0]);

			if (missingDeps.length > 0) {
				console.error(`\n======================================================`);
				console.error(`[FATAL] Missing required Chrome dependencies on Linux!`);
				console.error(`\nMissing shared libraries:`);
				missingDeps.forEach((dep) => console.error(`  - ${dep}`));

				const unresolved: string[] = [];
				let resolvedCommand = "";
				let label = "";

				if (checkCmd("apt-get")) {
					const depsPath = path.join(path.dirname(executablePath), "deb.deps");
					if (fs.existsSync(depsPath)) {
						try {
							const depsContent = fs.readFileSync(depsPath, "utf-8");
							const depsString = depsContent
								.split("\n")
								.map((l) => l.trim())
								.filter((l) => l.length > 0)
								.join(", ");

							label = "Using Chrome's bundled Debian dependency metadata.";
							resolvedCommand = `sudo apt-get update && sudo apt-get satisfy -y --no-install-recommends "${depsString}"`;
						} catch {
							// fallback
						}
					}

					if (!resolvedCommand && checkCmd("apt-file")) {
						try {
							console.log(`[Downloader] Refreshing APT file metadata...`);
							execSync("sudo apt-file update", { stdio: "inherit" });
							const resolved: string[] = [];
							for (const dep of missingDeps) {
								try {
									const out = execSync(`apt-file search ${dep}`, { stdio: "pipe" }).toString();
									const pkg = out.split(":")[0];
									if (pkg) resolved.push(pkg);
									else unresolved.push(dep);
								} catch {
									unresolved.push(dep);
								}
							}
							if (resolved.length > 0) {
								label = "Resolved packages via apt-file.";
								resolvedCommand = `sudo apt-get install -y ${Array.from(new Set(resolved)).join(" ")}`;
							}
						} catch {
							missingDeps.forEach((d) => unresolved.push(d));
						}
					} else if (!resolvedCommand) {
						missingDeps.forEach((d) => unresolved.push(d));
					}
				} else if (checkCmd("dnf")) {
					try {
						console.log(`[Downloader] Refreshing DNF metadata...`);
						execSync("sudo dnf makecache", { stdio: "inherit" });
						const resolved: string[] = [];
						for (const dep of missingDeps) {
							try {
								const out = execSync(`dnf provides '*/${dep}'`, { stdio: "pipe" }).toString();
								const match = out.match(/^([a-zA-Z0-9_\-]+[^\s]*)/m);
								if (match && match[1]) resolved.push(match[1]);
								else unresolved.push(dep);
							} catch {
								unresolved.push(dep);
							}
						}
						if (resolved.length > 0) {
							label = "Resolved packages via dnf.";
							resolvedCommand = `sudo dnf install ${Array.from(new Set(resolved)).join(" ")}`;
						}
					} catch {
						missingDeps.forEach((d) => unresolved.push(d));
					}
				} else if (checkCmd("pacman")) {
					try {
						console.log(`[Downloader] Refreshing Pacman metadata...`);
						execSync("sudo pacman -Fy", { stdio: "inherit" });
						const resolved: string[] = [];
						for (const dep of missingDeps) {
							try {
								const out = execSync(`pacman -Fq ${dep}`, { stdio: "pipe" }).toString().trim();
								const pkgs = out.split("\n").filter(Boolean);
								if (pkgs.length > 0) resolved.push(pkgs[0]);
								else unresolved.push(dep);
							} catch {
								unresolved.push(dep);
							}
						}
						if (resolved.length > 0) {
							label = "Resolved packages via pacman.";
							resolvedCommand = `sudo pacman -S ${Array.from(new Set(resolved)).join(" ")}`;
						}
					} catch {
						missingDeps.forEach((d) => unresolved.push(d));
					}
				} else if (checkCmd("zypper")) {
					try {
						console.log(`[Downloader] Refreshing Zypper metadata...`);
						execSync("sudo zypper refresh", { stdio: "inherit" });
						const resolved: string[] = [];
						for (const dep of missingDeps) {
							try {
								const out = execSync(`zypper --no-refresh wp ${dep}`, { stdio: "pipe" }).toString();
								const lines = out.split("\n");
								let pkg = "";
								for (const line of lines) {
									if (line.includes(" | ") && !line.includes("S | Name") && !line.includes("--+--")) {
										const parts = line.split("|").map((p) => p.trim());
										if (parts.length >= 2) {
											pkg = parts[1];
											break;
										}
									}
								}
								if (pkg) resolved.push(pkg);
								else unresolved.push(dep);
							} catch {
								unresolved.push(dep);
							}
						}
						if (resolved.length > 0) {
							label = "Resolved packages via zypper.";
							resolvedCommand = `sudo zypper install ${Array.from(new Set(resolved)).join(" ")}`;
						}
					} catch {
						missingDeps.forEach((d) => unresolved.push(d));
					}
				} else {
					missingDeps.forEach((d) => unresolved.push(d));
				}

				if (resolvedCommand) {
					console.error(`\n${label}`);
					console.error(`Please run:`);
					console.error(`  ${resolvedCommand}`);
				}

				if (unresolved.length > 0) {
					console.error(`\nCould not resolve package names for:`);
					unresolved.forEach((dep) => console.error(`  - ${dep}`));
					if (resolvedCommand) {
						console.error(`\nThe command above may not fully fix the issue because some libraries could not be resolved automatically.`);
					} else {
						console.error(`\nAutomatic package resolution is not available or failed. Please install these using your distribution's package manager.`);
					}
				}

				console.error(`======================================================\n`);
				process.exit(1);
			}
		} catch (err) {
			console.warn(`[Downloader] Warning: Could not run ldd to verify dependencies.`, err);
		}
	}

	return executablePath;
}

export async function ensureFfmpegDependencies(): Promise<string> {
	console.log(`[Downloader] Checking FFmpeg...`);
	const macRelease = process.platform === "darwin" ? getMacFfmpegRelease(process.arch) : null;
	const ext = process.platform === "win32" ? ".exe" : "";
	const ffmpegDest = path.join(CACHE_DIR, `ffmpeg${ext}`);
	const checksumFile = path.join(CACHE_DIR, "ffmpeg.sha256");
	const macMarker = macRelease ? `verified:macos-${process.arch}:${macRelease.sha256}` : null;
	let localSha = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, "utf8").trim() : "";
	let verifiedCached = await isVerifiedFfmpegCache(ffmpegDest, localSha, macMarker, macRelease?.binarySha256);

	try {
		let targetFile = macRelease?.file ?? "ffmpeg-master-latest-linux64-gpl.tar.xz";
		if (process.platform === "win32") targetFile = "ffmpeg-master-latest-win64-gpl.zip";

		let remoteSha = macRelease?.sha256 ?? "unknown";
		let downloadUrl = macRelease?.url ?? "";
		if (!macRelease) {
			const res = await fetch("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/checksums.sha256");
			if (!res.ok) throw new Error("FFmpeg checksum request failed");
			const checksumsList = await res.text();
			const line = checksumsList
				.split(/\r?\n/)
				.map((entry) => entry.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i))
				.find((entry) => entry?.[2] === targetFile);
			remoteSha = line?.[1]?.toLowerCase() ?? "unknown";
			downloadUrl = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${targetFile}`;
		}
		const expectedMarker = macMarker ?? `verified:${remoteSha}:`;

		if (!remoteSha || remoteSha === "unknown") {
			console.warn(`[Downloader] Warning: Could not find remote SHA for ${targetFile}. Skipping auto-update check.`);
			if (!verifiedCached) {
				throw new Error("Missing binary and no checksums available");
			} else {
				console.log(`[Downloader] FFmpeg is ready.`);
			}
		} else if (verifiedCached && (macMarker ? localSha === expectedMarker : localSha.startsWith(expectedMarker))) {
			console.log(`[Downloader] FFmpeg is ready and up to date.`);
		} else {
			console.log(`[Downloader] FFmpeg update found (or missing). Downloading...`);
			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipify-ffmpeg-"));
			const archivePath = path.join(tempDir, macRelease ? macRelease.file : process.platform === "win32" ? "ffmpeg.zip" : "ffmpeg.tar.xz");
			try {
				execFileSync(process.platform === "win32" ? "curl.exe" : "curl", ["-fsSL", "-o", archivePath, downloadUrl]);
				let extracted: string;
				if (macRelease) {
					extracted = path.join(tempDir, "ffmpeg");
					await extractVerifiedMacFfmpeg(archivePath, extracted, remoteSha, macRelease.binarySha256);
				} else if (process.platform === "win32") {
					await verifyArchiveChecksum(archivePath, remoteSha);
					execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force`]);
					extracted = path.join(tempDir, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe");
				} else {
					await verifyArchiveChecksum(archivePath, remoteSha);
					execFileSync("tar", ["-xf", archivePath, "--strip-components=2", "-C", tempDir, "ffmpeg-master-latest-linux64-gpl/bin/ffmpeg"]);
					extracted = path.join(tempDir, "ffmpeg");
				}
				fs.mkdirSync(CACHE_DIR, { recursive: true });
				const staged = path.join(CACHE_DIR, `ffmpeg-${process.pid}-${Date.now()}.tmp`);
				try {
					fs.copyFileSync(extracted, staged);
					fs.chmodSync(staged, 0o755);
					const binarySha = await sha256File(staged);
					if (macRelease && binarySha !== macRelease.binarySha256) throw new Error("FFmpeg binary checksum mismatch");
					fs.renameSync(staged, ffmpegDest);
					localSha = macMarker ?? `verified:${remoteSha}:${binarySha}`;
				} finally {
					fs.rmSync(staged, { force: true });
				}
			} finally {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
			fs.writeFileSync(checksumFile, localSha, "utf8");
			verifiedCached = true;
			console.log(`[Downloader] FFmpeg downloaded and updated to ${ffmpegDest}`);
		}
	} catch (err) {
		console.warn(`[Downloader] Warning: FFmpeg auto-updater failed:`, err);
		const fallbackMarker = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, "utf8").trim() : "";
		if (await isVerifiedFfmpegCache(ffmpegDest, fallbackMarker, macMarker, macRelease?.binarySha256)) {
			console.log(`[Downloader] Continuing with existing FFmpeg binary.`);
		} else throw err;
	}

	try {
		fs.chmodSync(ffmpegDest, 0o755);
	} catch (err) {
		console.warn(`[Downloader] Warning: Could not chmod FFmpeg binary:`, err);
	}

	return ffmpegDest;
}

let dependencyPreparation: Promise<{ chromePath: string; ffmpegPath: string }> | undefined;

export function ensureDependencies() {
	return (dependencyPreparation ??= prepareDependencies().catch((error: unknown) => {
		dependencyPreparation = undefined;
		throw error;
	}));
}

async function prepareDependencies() {
	if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
	const chromePath = await ensureChromeDependencies();
	const ffmpegPath = await ensureFfmpegDependencies();
	if (!fs.existsSync(chromePath) || !fs.existsSync(ffmpegPath)) throw new Error("Runner dependencies are not ready");
	return { chromePath, ffmpegPath };
}

async function resolveExistingBrowser(buildId: string) {
	// Let puppeteer/browsers compute it for us
	return computeExecutablePath({
		browser: Browser.CHROME,
		buildId,
		cacheDir: CACHE_DIR,
	});
}
