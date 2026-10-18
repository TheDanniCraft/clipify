import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const captureRequire = createRequire(require.resolve("puppeteer-stream"));
const coreRoot = dirname(captureRequire.resolve("puppeteer-core/package.json"));
test.each(["cjs", "esm"])("DEF-US1-031: actual installed %s launcher awaits every extension installation", async (format) => {
	const source = readFileSync(join(coreRoot, `lib/${format}/puppeteer/node/BrowserLauncher.js`), "utf8");
	const start = source.indexOf("        if (Array.isArray(enableExtensions)) {");
	const end = source.indexOf("        if (waitForInitialPage)", start);
	expect(start).toBeGreaterThan(0);
	expect(end).toBeGreaterThan(start);
	// Execute the installed launcher's exact extension-install block; substitute only the private Chrome selector.
	const body = source.slice(start, end).replaceAll("this.#browser", JSON.stringify("chrome"));
	const installation = new Function("browser", "enableExtensions", "usePipe", `return (async()=>{${body}})();`) as (browser: unknown, paths: string[], pipe: boolean) => Promise<void>;
	const finish: Array<() => void> = [];
	const installExtension = jest.fn(() => new Promise<void>((resolve) => finish.push(resolve)));
	let ready = false;
	const launched = installation({ installExtension }, ["capture", "another-extension"], true).then(() => {
		ready = true;
	});
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(installExtension).toHaveBeenCalledTimes(2);
	expect(ready).toBe(false);
	finish[0]();
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(ready).toBe(false);
	finish[1]();
	await launched;
	expect(ready).toBe(true);
});
