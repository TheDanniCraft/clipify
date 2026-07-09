import os from "os";
import path from "path";
import fs from "fs";
import { install, resolveBuildId, Browser } from "@puppeteer/browsers";
import { execSync } from "child_process";

const CACHE_DIR = path.join(os.homedir(), ".clipify-runner", "bin");

export async function ensureDependencies() {
	if (!fs.existsSync(CACHE_DIR)) {
		fs.mkdirSync(CACHE_DIR, { recursive: true });
	}

	console.log(`[Downloader] Checking Chromium...`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const buildId = await resolveBuildId(Browser.CHROME, process.platform as any, "stable");

	const browserPath = path.join(CACHE_DIR, "chrome", process.platform, buildId);
	let executablePath = "";

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

	if (!fs.existsSync(browserPath)) {
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

	console.log(`[Downloader] Checking FFmpeg...`);
	const ext = process.platform === "win32" ? ".exe" : "";
	const ffmpegDest = path.join(CACHE_DIR, `ffmpeg${ext}`);
	const checksumFile = path.join(CACHE_DIR, "ffmpeg.sha256");

	try {
		let targetFile = "ffmpeg-master-latest-linux64-gpl.tar.xz";
		if (process.platform === "win32") targetFile = "ffmpeg-master-latest-win64-gpl.zip";
		if (process.platform === "darwin") targetFile = "ffmpeg-master-latest-osx64-gpl.zip"; // BtbN added osx recently or we can use another. Wait, does BtbN have osx?
		// Actually BtbN does NOT have macOS. We will use evermeet.cx or github.com/eugeneware/ffmpeg-static for macOS.

		let downloadUrl = "";
		let remoteSha = "";
		const isMacOS = process.platform === "darwin";

		if (isMacOS) {
			// Using evermeet.cx static build
			downloadUrl = "https://evermeet.cx/ffmpeg/ffmpeg-6.0.zip";
			// evermeet.cx provides hashes at /ffmpeg/info/ffmpeg/6.0
			remoteSha = "macos-static-6.0"; // hardcoded for evermeet
		} else {
			const checksumsUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/checksums.sha256";
			const res = await fetch(checksumsUrl);
			const checksumsList = await res.text();
			const line = checksumsList.split("\n").find((l) => l.includes(targetFile));
			remoteSha = line ? line.split(/\s+/)[0] : "unknown";
			downloadUrl = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${targetFile}`;
		}

		let localSha = "";
		if (fs.existsSync(checksumFile)) {
			localSha = fs.readFileSync(checksumFile, "utf8").trim();
		}

		if (!remoteSha || remoteSha === "unknown") {
			console.warn(`[Downloader] Warning: Could not find remote SHA for ${targetFile}. Skipping auto-update check.`);
			if (!fs.existsSync(ffmpegDest)) {
				throw new Error("Missing binary and no checksums available");
			} else {
				console.log(`[Downloader] FFmpeg is ready.`);
			}
		} else if (localSha === remoteSha && fs.existsSync(ffmpegDest)) {
			console.log(`[Downloader] FFmpeg is ready and up to date.`);
		} else {
			console.log(`[Downloader] FFmpeg update found (or missing). Downloading...`);
			if (process.platform === "win32") {
				const tempZip = path.join(os.tmpdir(), "ffmpeg.zip");
				execSync(`curl.exe -L -o "${tempZip}" "${downloadUrl}"`, { stdio: "inherit" });
				execSync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${CACHE_DIR}' -Force"`, { stdio: "inherit" });
				fs.copyFileSync(path.join(CACHE_DIR, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe"), ffmpegDest);
			} else if (process.platform === "darwin") {
				const tempZip = path.join(os.tmpdir(), "ffmpeg.zip");
				execSync(`curl -sL -o "${tempZip}" "${downloadUrl}"`, { stdio: "inherit" });
				execSync(`unzip -o "${tempZip}" -d "${CACHE_DIR}"`, { stdio: "inherit" });
				// evermeet zip directly contains the 'ffmpeg' binary at the root
			} else {
				const tempTar = path.join(os.tmpdir(), "ffmpeg.tar.xz");
				execSync(`curl -sL -o "${tempTar}" "${downloadUrl}"`, { stdio: "inherit" });
				execSync(`tar -xf "${tempTar}" --strip-components=2 -C "${CACHE_DIR}" ffmpeg-master-latest-linux64-gpl/bin/ffmpeg`, { stdio: "inherit" });
			}
			fs.writeFileSync(checksumFile, remoteSha, "utf8");
			console.log(`[Downloader] FFmpeg downloaded and updated to ${ffmpegDest}`);
		}
	} catch (err) {
		console.warn(`[Downloader] Warning: FFmpeg auto-updater failed:`, err);
		if (!fs.existsSync(ffmpegDest)) {
			console.error(`[Downloader] FFmpeg does not exist locally and download failed!`);
		} else {
			console.log(`[Downloader] Continuing with existing FFmpeg binary.`);
		}
	}

	try {
		fs.chmodSync(ffmpegDest, 0o755);
	} catch (err) {
		console.warn(`[Downloader] Warning: Could not chmod FFmpeg binary:`, err);
	}

	return { chromePath: executablePath, ffmpegPath: ffmpegDest };
}

async function resolveExistingBrowser(buildId: string) {
	// Let puppeteer/browsers compute it for us
	const { computeExecutablePath } = await import("@puppeteer/browsers");
	return computeExecutablePath({
		browser: Browser.CHROME,
		buildId,
		cacheDir: CACHE_DIR,
	});
}
