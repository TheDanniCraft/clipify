/** @jest-environment node */

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

jest.mock("@puppeteer/browsers", () => ({ install: jest.fn(), resolveBuildId: jest.fn(), computeExecutablePath: jest.fn(), Browser: { CHROME: "chrome" } }));

import { extractVerifiedMacFfmpeg, getMacFfmpegRelease, verifyArchiveChecksum } from "../downloader";

it("pins separate Intel and Apple Silicon FFmpeg archives", () => {
	expect(getMacFfmpegRelease("x64")).toMatchObject({ file: "ffmpeg-darwin-x64.gz", sha256: "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106" });
	expect(getMacFfmpegRelease("arm64")).toMatchObject({ file: "ffmpeg-darwin-arm64.gz", sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa" });
	expect(() => getMacFfmpegRelease("ia32")).toThrow("Unsupported macOS architecture");
});

it("verifies a macOS archive before extraction and checks the extracted binary", async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clipify-mac-ffmpeg-test-"));
	try {
		const archive = path.join(directory, "ffmpeg.gz");
		const binary = path.join(directory, "ffmpeg");
		const bytes = Buffer.from("fixture ffmpeg binary");
		const archiveBytes = gzipSync(bytes);
		fs.writeFileSync(archive, archiveBytes);
		const archiveSha = createHash("sha256").update(archiveBytes).digest("hex");
		const binarySha = createHash("sha256").update(bytes).digest("hex");

		await expect(extractVerifiedMacFfmpeg(archive, binary, "0".repeat(64), binarySha)).rejects.toThrow("FFmpeg archive checksum mismatch");
		expect(fs.existsSync(binary)).toBe(false);
		await expect(extractVerifiedMacFfmpeg(archive, binary, archiveSha, binarySha)).resolves.toBeUndefined();
		expect(fs.readFileSync(binary)).toEqual(bytes);
		await expect(extractVerifiedMacFfmpeg(archive, binary, archiveSha, "0".repeat(64))).rejects.toThrow("FFmpeg archive checksum mismatch");
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

it("rejects substituted FFmpeg bytes before extraction", async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clipify-ffmpeg-test-"));
	try {
		const archive = path.join(directory, "ffmpeg.zip");
		fs.writeFileSync(archive, "trusted archive");
		const expected = createHash("sha256").update("trusted archive").digest("hex");
		await expect(verifyArchiveChecksum(archive, expected)).resolves.toBeUndefined();
		fs.writeFileSync(archive, "substituted archive");
		await expect(verifyArchiveChecksum(archive, expected)).rejects.toThrow("FFmpeg archive checksum mismatch");
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
