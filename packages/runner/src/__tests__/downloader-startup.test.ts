/** @jest-environment node */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

jest.mock("@puppeteer/browsers", () => ({ install: jest.fn(), resolveBuildId: jest.fn(), computeExecutablePath: jest.fn(), Browser: { CHROME: "chrome" } }));
jest.mock("os", () => ({ ...jest.requireActual("os"), homedir: () => jest.requireActual("path").join(jest.requireActual("os").tmpdir(), `clipify-downloader-failure-${process.pid}`) }));
jest.mock("child_process", () => ({
	...jest.requireActual("child_process"),
	execFileSync: jest.fn(() => {
		throw new Error("network unavailable");
	}),
}));

import { ensureFfmpegDependencies } from "../downloader";

it("stops startup when FFmpeg's first download fails", async () => {
	const cacheHome = os.homedir();
	const originalFetch = global.fetch;
	const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	fs.rmSync(cacheHome, { recursive: true, force: true });
	global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));
	Object.defineProperty(process, "platform", { value: "linux", configurable: true });
	try {
		await expect(ensureFfmpegDependencies()).rejects.toThrow("network unavailable");
		expect(fs.existsSync(path.join(cacheHome, ".clipify-runner", "bin", "ffmpeg"))).toBe(false);
	} finally {
		global.fetch = originalFetch;
		Object.defineProperty(process, "platform", platformDescriptor);
		fs.rmSync(cacheHome, { recursive: true, force: true });
	}
});

it("uses only an intact verified cached FFmpeg when the updater is offline", async () => {
	const cacheHome = os.homedir();
	const cacheDir = path.join(cacheHome, ".clipify-runner", "bin");
	const ffmpeg = path.join(cacheDir, "ffmpeg");
	const originalFetch = global.fetch;
	const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	fs.rmSync(cacheHome, { recursive: true, force: true });
	fs.mkdirSync(cacheDir, { recursive: true });
	fs.writeFileSync(ffmpeg, "verified binary");
	const binarySha = createHash("sha256").update("verified binary").digest("hex");
	fs.writeFileSync(path.join(cacheDir, "ffmpeg.sha256"), `verified:${"a".repeat(64)}:${binarySha}`);
	global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));
	Object.defineProperty(process, "platform", { value: "linux", configurable: true });
	try {
		await expect(ensureFfmpegDependencies()).resolves.toBe(ffmpeg);
		fs.writeFileSync(ffmpeg, "tampered binary");
		await expect(ensureFfmpegDependencies()).rejects.toThrow("network unavailable");
	} finally {
		global.fetch = originalFetch;
		Object.defineProperty(process, "platform", platformDescriptor);
		fs.rmSync(cacheHome, { recursive: true, force: true });
	}
});

it("rejects an unverified legacy macOS cache when its download fails", async () => {
	const cacheHome = os.homedir();
	const cacheDir = path.join(cacheHome, ".clipify-runner", "bin");
	const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	const archDescriptor = Object.getOwnPropertyDescriptor(process, "arch")!;
	fs.rmSync(cacheHome, { recursive: true, force: true });
	fs.mkdirSync(cacheDir, { recursive: true });
	fs.writeFileSync(path.join(cacheDir, "ffmpeg"), "legacy unverified binary");
	fs.writeFileSync(path.join(cacheDir, "ffmpeg.sha256"), "macos-static-6.0");
	Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
	Object.defineProperty(process, "arch", { value: "arm64", configurable: true });
	try {
		await expect(ensureFfmpegDependencies()).rejects.toThrow("network unavailable");
		expect(execFileSync).toHaveBeenCalledWith("curl", ["-fsSL", "-o", expect.any(String), "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-arm64.gz"]);
		expect(fs.readFileSync(path.join(cacheDir, "ffmpeg"), "utf8")).toBe("legacy unverified binary");
	} finally {
		Object.defineProperty(process, "platform", platformDescriptor);
		Object.defineProperty(process, "arch", archDescriptor);
		fs.rmSync(cacheHome, { recursive: true, force: true });
	}
});
