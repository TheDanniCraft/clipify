import { install, Browser } from "@puppeteer/browsers";
import { appendFileSync } from "node:fs";
import { cacheDir, chromeBuildId, nativeChromePath } from "./native-media.mjs";

if (!process.env.RUNNER_CHROME_PATH) await install({ cacheDir, browser: Browser.CHROME, buildId: chromeBuildId });
const executable = nativeChromePath();
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `RUNNER_CHROME_PATH=${executable}\n`);
console.log(executable);
