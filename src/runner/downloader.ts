import os from "os";
import path from "path";
import fs from "fs";
import { install, resolveBuildId, Browser } from "@puppeteer/browsers";
import { execSync } from "child_process";
// @ts-expect-error no types available
import ffbinaries from "ffbinaries";

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

	if (!fs.existsSync(browserPath)) {
		console.log(`[Downloader] Downloading Chromium (${buildId}). This may take a minute...`);
		const installed = await install({
			browser: Browser.CHROME,
			buildId,
			cacheDir: CACHE_DIR,
		});
		executablePath = installed.executablePath;
		console.log(`[Downloader] Chromium downloaded to ${executablePath}`);
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
				console.error(`Please install the following missing libraries:\n`);
				missingDeps.forEach((dep) => console.error(`  - ${dep}`));
				console.error(`\nTo fix this on Debian/Ubuntu, run:`);
				console.error(`sudo apt-get update && sudo apt-get install -y ca-certificates fonts-liberation libnss3 libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libcairo2 libpango-1.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libatspi2.0-0`);
				console.error(`(Note: If libasound2 fails on newer Ubuntu, use libasound2t64 instead).`);
				console.error(`======================================================\n`);
				process.exit(1);
			}
		} catch (err) {
			console.warn(`[Downloader] Warning: Could not run ldd to verify dependencies.`, err);
		}
	}

	console.log(`[Downloader] Checking FFmpeg...`);
	const ffmpegDest = path.join(CACHE_DIR, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	if (!fs.existsSync(ffmpegDest)) {
		console.log(`[Downloader] Downloading FFmpeg...`);
		await new Promise<void>((resolve, reject) => {
			ffbinaries.downloadBinaries(["ffmpeg"], { destination: CACHE_DIR }, (err: string | null) => {
				if (err) {
					console.error("[Downloader] FFmpeg download failed:", err);
					reject(err);
				} else {
					resolve();
				}
			});
		});
		console.log(`[Downloader] FFmpeg downloaded to ${ffmpegDest}`);
	} else {
		console.log(`[Downloader] FFmpeg is ready.`);
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
