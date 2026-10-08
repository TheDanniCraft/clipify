/** @jest-environment node */
import { readFileSync } from "node:fs";

const { selectBrowserServerHeapMiB, browserServerNodeOptions } = require("../../../scripts/browser-server-budget.cjs");
const GiB = 1024 ** 3;
const profile = (freeGiB: number, totalGiB = 128) => ({ cpuCount: 16, availableMemoryBytes: freeGiB * GiB, totalMemoryBytes: totalGiB * GiB });

test("large machines give the compiling browser server bounded additional headroom", () => {
	expect(selectBrowserServerHeapMiB(profile(64))).toBe(12288);
});

test("an 8 GiB machine reserves memory for browser, database and workers", () => {
	expect(selectBrowserServerHeapMiB(profile(6, 8))).toBe(2048);
});

test("a busy machine scales down instead of inheriting a fixed six GiB heap", () => {
	expect(selectBrowserServerHeapMiB(profile(1.5, 8))).toBe(512);
});

test("unavailable metrics use a conservative heap budget", () => {
	expect(selectBrowserServerHeapMiB({ cpuCount: 1, availableMemoryBytes: NaN, totalMemoryBytes: 0 })).toBe(512);
});

test("explicit Node options are preserved exactly", () => {
	expect(browserServerNodeOptions("--max-old-space-size=3072 --enable-source-maps", profile(64))).toBe("--max-old-space-size=3072 --enable-source-maps");
});

test("automatic options apply the selected compiler budget", () => {
	expect(browserServerNodeOptions(undefined, profile(64))).toBe("--max-old-space-size=12288");
	expect(browserServerNodeOptions("", profile(6, 8))).toBe("--max-old-space-size=2048");
});

test("the managed Playwright server uses the adaptive options", () => {
	const config = readFileSync("playwright.config.ts", "utf8");
	expect(config).toContain("browserServerNodeOptions(process.env.NODE_OPTIONS)");
	expect(config).not.toContain('process.env.NODE_OPTIONS ?? "--max-old-space-size=6144"');
});
