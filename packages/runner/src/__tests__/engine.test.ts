import { Engine, proxyEvents } from "../engine";
import * as downloader from "../downloader";
import { spawn } from "child_process";
import { launch, getStream } from "puppeteer-stream";

jest.mock("child_process");
jest.mock("puppeteer-stream");
jest.mock("fs");
jest.mock("net", () => ({
	createServer: jest.fn().mockReturnValue({
		once: jest.fn(),
		off: jest.fn(),
		listen: jest.fn((port, cb) => cb && cb()),
		close: jest.fn(),
	}),
}));
jest.mock("../downloader", () => ({
	ensureDependencies: jest.fn().mockResolvedValue({
		chromePath: "/mock/chrome",
		ffmpegPath: "/mock/ffmpeg",
	}),
}));
jest.mock("../extension", () => ({
	writeExtension: jest.fn(),
}));

describe("Engine (Raw Logic Tests)", () => {
	let mockSpawn: jest.Mock;
	let mockLaunch: jest.Mock;
	let mockGetStream: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		mockSpawn = spawn as jest.Mock;
		mockSpawn.mockReturnValue({
			killed: false,
			exitCode: null,
			signalCode: null,
			on: jest.fn(),
			once: jest.fn((event, cb) => {
				if (event === "close") cb();
			}),
			stdin: { on: jest.fn(), end: jest.fn() },
			stderr: { on: jest.fn() },
			kill: jest.fn(),
		});

		mockLaunch = launch as jest.Mock;
		mockLaunch.mockResolvedValue({
			newPage: jest.fn().mockResolvedValue({
				goto: jest.fn().mockResolvedValue(null),
				evaluate: jest.fn().mockResolvedValue(true),
			}),
			close: jest.fn().mockResolvedValue(null),
		});

		mockGetStream = getStream as jest.Mock;
		mockGetStream.mockResolvedValue({
			pipe: jest.fn(),
			destroy: jest.fn(),
		});

		// Mock fetch for preview uploader to not hang
		global.fetch = jest.fn().mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	it("24_7 mode should start Puppeteer and FFmpeg (Cloud Loop) immediately", async () => {
		const engine = new Engine("overlay-123", "rtmp://fake", "secret", "streamKey", 60, "1080p", "24_7", "http://api");
		await engine.start();

		// 1. Ensures dependencies
		expect(downloader.ensureDependencies).toHaveBeenCalled();

		// 2. Starts Puppeteer background
		expect(mockLaunch).toHaveBeenCalled();

		// 3. Spawns Cloud Loop FFmpeg immediately
		expect(mockSpawn).toHaveBeenCalledWith("/mock/ffmpeg", expect.arrayContaining(["-i", "-", "-c:v", "libx264"]), expect.any(Object));

		await engine.stop();
	});

	it("Failsafe mode should start Puppeteer but NOT FFmpeg immediately", async () => {
		const engine = new Engine("overlay-failsafe", "rtmp://fake", "secret", "streamKey", 60, "1080p", "failsafe", "http://api");
		await engine.start();

		// 1. Starts Puppeteer background
		expect(mockLaunch).toHaveBeenCalled();

		// 2. Should NOT spawn FFmpeg yet (waiting for OBS)
		expect(mockSpawn).not.toHaveBeenCalled();

		await engine.stop();
	});

	it("Failsafe mode should spawn OBS Forwarder when OBS connects", async () => {
		jest.useFakeTimers();
		const engine = new Engine("overlay-failsafe", "rtmp://fake", "secret", "streamKey", 60, "1080p", "failsafe", "http://api");
		await engine.start();

		expect(mockSpawn).not.toHaveBeenCalled(); // No FFmpeg yet

		// Simulate OBS connecting to the proxy port 1935
		proxyEvents.emit("obsConnected");

		await (engine as unknown as { transitionPromise: Promise<void> }).transitionPromise;

		// Should spawn OBS Forwarder
		expect(mockSpawn).toHaveBeenCalledWith("/mock/ffmpeg", expect.arrayContaining(["-listen", "1", "-i", "rtmp://127.0.0.1:1936"]), expect.any(Object));

		await engine.stop();
		jest.useRealTimers();
	});

	it("Failsafe mode should fall back to Cloud Loop when OBS disconnects", async () => {
		jest.useFakeTimers();
		const engine = new Engine("overlay-failsafe", "rtmp://fake", "secret", "streamKey", 60, "1080p", "failsafe", "http://api");
		await engine.start();

		// OBS Connects
		proxyEvents.emit("obsConnected");
		await (engine as unknown as { transitionPromise: Promise<void> }).transitionPromise;

		// OBS Disconnects
		proxyEvents.emit("obsDisconnected");
		await (engine as unknown as { transitionPromise: Promise<void> }).transitionPromise;

		// Should fallback to Cloud Loop
		expect(mockSpawn).toHaveBeenCalledWith("/mock/ffmpeg", expect.arrayContaining(["-i", "-", "-c:v", "libx264"]), expect.any(Object));

		await engine.stop();
		jest.useRealTimers();
	});
});
