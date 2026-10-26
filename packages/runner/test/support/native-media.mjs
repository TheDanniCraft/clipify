import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { Browser, computeExecutablePath } from "@puppeteer/browsers";

const require = createRequire(import.meta.url);
const captureRequire = createRequire(require.resolve("puppeteer-stream"));
export const chromeBuildId = captureRequire("puppeteer-core").PUPPETEER_REVISIONS.chrome;
export const cacheDir = fileURLToPath(new URL("../../node_modules/.cache/clipify-test-browsers", import.meta.url));

export function nativeChromePath() {
	const executable = process.env.RUNNER_CHROME_PATH || computeExecutablePath({ cacheDir, browser: Browser.CHROME, buildId: chromeBuildId });
	if (!existsSync(executable)) throw new Error("Native test Chrome is missing. Run node test/support/prepare-media.mjs from packages/runner, then install its Linux deb.deps and FFmpeg.");
	return executable;
}
