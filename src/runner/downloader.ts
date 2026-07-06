import os from "os";
import path from "path";
import fs from "fs";
import { install, resolveBuildId, Browser } from "@puppeteer/browsers";
import ffbinaries from "ffbinaries";

const CACHE_DIR = path.join(os.homedir(), ".clipify-runner", "bin");

export async function ensureDependencies() {
	if (!fs.existsSync(CACHE_DIR)) {
		fs.mkdirSync(CACHE_DIR, { recursive: true });
	}

	console.log(`[Downloader] Checking Chromium...`);
	const buildId = await resolveBuildId(Browser.CHROME, process.platform, "latest");
	
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

	console.log(`[Downloader] Checking FFmpeg...`);
	const ffmpegDest = path.join(CACHE_DIR, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	if (!fs.existsSync(ffmpegDest)) {
		console.log(`[Downloader] Downloading FFmpeg...`);
		await new Promise<void>((resolve, reject) => {
			ffbinaries.downloadBinaries(["ffmpeg"], { destination: CACHE_DIR }, (err: Error | null) => {
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
