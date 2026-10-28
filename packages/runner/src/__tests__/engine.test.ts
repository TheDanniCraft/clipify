import { Engine, proxyEvents } from "../engine";
import * as downloader from "../downloader";
import { spawn } from "child_process";
import { launch, getStream } from "puppeteer-stream";
import * as fs from "fs";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

jest.mock("child_process");
jest.mock("puppeteer-stream", () => ({ launch: jest.fn(), getStream: jest.fn() }));
jest.mock("fs");
jest.mock("net", () => ({
	...jest.requireActual("net"),
	createServer: jest.fn().mockReturnValue({
		once: jest.fn(),
		off: jest.fn(),
		listen: jest.fn((port, host, cb) => cb && cb()),
		close: jest.fn((cb) => cb && cb()),
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
		jest.spyOn(console, "log").mockImplementation(() => {});

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
				evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
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
		jest.restoreAllMocks();
	});

	it("TDD-US4-DEC012 U290: a blocked playing layout refuses output normally and destroys capture", async () => {
		const generation = "261e5175-a2d2-4c98-88fa-3e39df3f6323";
		const previousWindow = Reflect.get(globalThis, "window"),
			previousDocument = Reflect.get(globalThis, "document");
		let playing = false,
			renderedGeneration = generation,
			bridgeGeneration = generation,
			contentEpoch = 1,
			contentPhase = "playback",
			layoutStatus = "blocked",
			keyMatches = true,
			contentPresent = true;
		const startPlayback = jest.fn(() => {
			playing = true;
		});
		const content = { getAttribute: (name: string) => (name === "data-runner-content-epoch" ? String(playing ? contentEpoch : 0) : name === "data-runner-content-phase" ? (playing ? contentPhase : "standby") : "fixture-clip") };
		const surface = { querySelector: () => (contentPresent ? content : null), getAttribute: (name: string) => (name === "data-runner-presentation-generation" ? renderedGeneration : name === "data-runner-layout-status" ? (playing ? layoutStatus : "placed") : keyMatches ? `${playing ? contentEpoch : 0}:${playing ? contentPhase : "standby"}:fixture-clip` : "stale-key") };
		Reflect.set(globalThis, "document", { querySelector: (selector: string) => (selector.includes("presentation-generation") ? surface : content) });
		Reflect.set(globalThis, "window", {
			startRunnerPlayback: startPlayback,
			stopFallback: () => {
				playing = false;
			},
			clipifyRunnerPresentation: { snapshot: () => ({ generation: bridgeGeneration }) },
		});
		const page = {
			evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)),
			waitForFunction: jest.fn(async (fn: (...args: unknown[]) => unknown, _options: unknown, ...args: unknown[]) => {
				const result = fn(...args);
				if (!result) throw new Error("Renderer is not ready");
				return { jsonValue: async () => result, dispose: jest.fn().mockResolvedValue(undefined) };
			}),
		};
		const close = jest.fn().mockResolvedValue(undefined);
		const captured = { pipe: jest.fn(), destroy: jest.fn() };
		mockGetStream.mockResolvedValueOnce(captured);
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", { executionGeneration: generation, presentationSessionId: "8b01b0e0-a941-4a3d-804b-823d2c5a54d5" });
		Reflect.set(engine, "page", page);
		Reflect.set(engine, "browser", { close });
		try {
			await expect(engine.start()).resolves.toBe(false);
			expect(startPlayback).toHaveBeenCalledTimes(1);
			expect(mockGetStream.mock.invocationCallOrder[0]).toBeLessThan(startPlayback.mock.invocationCallOrder[0]);
			expect(mockSpawn).not.toHaveBeenCalled();
			expect(captured.destroy).toHaveBeenCalledTimes(1);
			expect(engine.isRunning).toBe(false);
			expect(engine.ffmpegStatus).toMatch(/layout/i);
			const ready = page.waitForFunction.mock.calls[0][0];
			playing = true;
			expect(ready(generation, 0)).toBe("blocked");
			layoutStatus = "placed";
			expect(ready(generation, 0)).toBe("placed");
			contentEpoch = 0;
			expect(ready(generation, 0)).toBe(false);
			contentEpoch = NaN;
			expect(ready(generation, 0)).toBe(false);
			contentEpoch = 1;
			contentPhase = "loading";
			expect(ready(generation, 0)).toBe(false);
			contentPhase = "standby";
			expect(ready(generation, 0)).toBe(false);
			contentPhase = "playback";
			renderedGeneration = "foreign";
			expect(ready(generation, 0)).toBe(false);
			renderedGeneration = generation;
			bridgeGeneration = "foreign";
			expect(ready(generation, 0)).toBe(false);
			bridgeGeneration = generation;
			keyMatches = false;
			expect(ready(generation, 0)).toBe(false);
			layoutStatus = "clean";
			expect(ready(generation, 0)).toBe("clean");
			keyMatches = true;
			layoutStatus = "placed";
			contentPhase = "empty";
			expect(ready(generation, 0)).toBe("placed");
			contentPresent = false;
			expect(ready(generation, 0)).toBe(false);
		} finally {
			await engine.stop();
			if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
			else Reflect.set(globalThis, "window", previousWindow);
			if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
			else Reflect.set(globalThis, "document", previousDocument);
		}
	});

	it.each([null, "not-a-number", "-1"])("TDD-US4-DEC012 U290 baseline: missing or invalid initial content epoch %s refuses before playback", async (rawEpoch) => {
		const previousWindow = Reflect.get(globalThis, "window"),
			previousDocument = Reflect.get(globalThis, "document");
		const startPlayback = jest.fn();
		Reflect.set(globalThis, "document", { querySelector: () => ({ querySelector: () => ({ getAttribute: () => rawEpoch }) }) });
		Reflect.set(globalThis, "window", { startRunnerPlayback: startPlayback, stopFallback: jest.fn() });
		const page = { evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)), waitForFunction: jest.fn() };
		const captured = { pipe: jest.fn(), destroy: jest.fn() };
		mockGetStream.mockResolvedValueOnce(captured);
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", { executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323", presentationSessionId: "8b01b0e0-a941-4a3d-804b-823d2c5a54d5" });
		Reflect.set(engine, "page", page);
		Reflect.set(engine, "browser", { close: jest.fn().mockResolvedValue(undefined) });
		try {
			await expect(engine.start()).resolves.toBe(false);
			expect(startPlayback).not.toHaveBeenCalled();
			expect(page.waitForFunction).not.toHaveBeenCalled();
			expect(mockSpawn).not.toHaveBeenCalled();
			expect(captured.destroy).toHaveBeenCalledTimes(1);
			expect(engine.isRunning).toBe(false);
		} finally {
			await engine.stop();
			if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
			else Reflect.set(globalThis, "window", previousWindow);
			if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
			else Reflect.set(globalThis, "document", previousDocument);
		}
	});

	it.each(["placed", "clean", "pending", "timeout", "permission-revoked"])("TDD-US4-DEC012 U290 baseline: deferred startup readiness %s fences encoder publication", async (terminal) => {
		const previousWindow = Reflect.get(globalThis, "window"),
			previousDocument = Reflect.get(globalThis, "document");
		Reflect.set(globalThis, "document", { querySelector: () => ({ querySelector: () => ({ getAttribute: () => "0" }) }) });
		Reflect.set(globalThis, "window", { startRunnerPlayback: jest.fn(), stopFallback: jest.fn() });
		let allowed = true;
		const handle = { jsonValue: jest.fn().mockResolvedValue(terminal === "permission-revoked" ? "placed" : terminal), dispose: jest.fn().mockResolvedValue(undefined) };
		let resolveReadiness!: (value: typeof handle) => void, rejectReadiness!: (reason: Error) => void, reportEntered!: () => void;
		const entered = new Promise<void>((resolve) => {
			reportEntered = resolve;
		});
		const readiness = new Promise<typeof handle>((resolve, reject) => {
			resolveReadiness = resolve;
			rejectReadiness = reject;
		});
		const page = {
			evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)),
			waitForFunction: jest.fn(() => {
				reportEntered();
				return readiness;
			}),
		};
		const captured = { pipe: jest.fn(), destroy: jest.fn() };
		mockGetStream.mockResolvedValueOnce(captured);
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", { executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323", presentationSessionId: "8b01b0e0-a941-4a3d-804b-823d2c5a54d5", mayOpenOutput: () => allowed });
		Reflect.set(engine, "page", page);
		Reflect.set(engine, "browser", { close: jest.fn().mockResolvedValue(undefined) });
		const starting = engine.start();
		try {
			await entered;
			expect(mockSpawn).not.toHaveBeenCalled();
			if (terminal === "permission-revoked") allowed = false;
			if (terminal === "timeout") rejectReadiness(new Error("Readiness timed out"));
			else resolveReadiness(handle);
			const result = await starting;
			if (terminal === "placed" || terminal === "clean") {
				expect(result).not.toBe(false);
				expect(mockSpawn).toHaveBeenCalledTimes(1);
				expect(handle.dispose).toHaveBeenCalledTimes(1);
			} else {
				expect(mockSpawn).not.toHaveBeenCalled();
				if (terminal !== "permission-revoked") {
					expect(result).toBe(false);
					expect(captured.destroy).toHaveBeenCalledTimes(1);
					expect(engine.isRunning).toBe(false);
				}
			}
		} finally {
			resolveReadiness(handle);
			await Promise.allSettled([starting]);
			await engine.stop();
			if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
			else Reflect.set(globalThis, "window", previousWindow);
			if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
			else Reflect.set(globalThis, "document", previousDocument);
		}
	});

	it("TDD-US4-CON012: a denied presentation returns a normal refusal without opening an encoder", async () => {
		(global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 403 }));
		const options = Object.assign({ executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323" }, { presentationSessionId: "8b01b0e0-a941-4a3d-804b-823d2c5a54d5" });
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", options);
		try {
			await expect(engine.start()).resolves.toBe(false);
			expect(mockGetStream).not.toHaveBeenCalled();
			expect(mockSpawn).not.toHaveBeenCalled();
			expect(engine.isRunning).toBe(false);
			expect(engine.ffmpegStatus).toBe("Runner presentation authorization failed. Reconnect and try again.");
		} finally {
			await engine.stop();
		}
	});

	it("TDD-US4-CON012: an unavailable rendered generation returns a refusal before capture", async () => {
		const sessionId = "8b01b0e0-a941-4a3d-804b-823d2c5a54d5";
		(global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}` }), { status: 200, headers: { "set-cookie": `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict` } }));
		const page = { goto: jest.fn().mockResolvedValue(undefined), setCookie: jest.fn().mockResolvedValue(undefined), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), waitForFunction: jest.fn().mockRejectedValue(new Error("private stale generation details")) };
		const close = jest.fn().mockResolvedValue(undefined);
		mockLaunch.mockResolvedValue({ newPage: jest.fn().mockResolvedValue(page), close });
		const options = Object.assign({ executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323" }, { presentationSessionId: sessionId });
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", options);
		try {
			await expect(engine.start()).resolves.toBe(false);
			expect(mockGetStream).not.toHaveBeenCalled();
			expect(mockSpawn).not.toHaveBeenCalled();
			expect(engine.isRunning).toBe(false);
			expect(close).toHaveBeenCalledTimes(1);
			expect(engine.ffmpegStatus).not.toContain("private stale generation details");
		} finally {
			await engine.stop();
		}
	});

	it("TDD-US4-CON012: the private presentation cookie refreshes without navigation and stops with the browser", async () => {
		jest.useFakeTimers();
		const sessionId = "8b01b0e0-a941-4a3d-804b-823d2c5a54d5";
		let requests = 0;
		(global.fetch as jest.Mock).mockImplementation(async () => (++requests === 2 ? new Response(null, { status: 503 }) : new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}` }), { status: 200, headers: { "set-cookie": `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict` } })));
		const page = { goto: jest.fn().mockResolvedValue(undefined), setCookie: jest.fn().mockResolvedValue(undefined), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), waitForFunction: jest.fn().mockResolvedValue(undefined) };
		const close = jest.fn().mockResolvedValue(undefined);
		mockLaunch.mockResolvedValue({ newPage: jest.fn().mockResolvedValue(page), close });
		const options = Object.assign({ executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323" }, { presentationSessionId: sessionId });
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", options);
		engine.isRunning = true;
		try {
			await Reflect.get(engine, "startChromiumBackground").call(engine);
			await jest.advanceTimersByTimeAsync(299999);
			expect(global.fetch).toHaveBeenCalledTimes(1);
			await jest.advanceTimersByTimeAsync(1);
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(page.setCookie).toHaveBeenCalledTimes(1);
			expect(engine.isRunning).toBe(true);
			await jest.advanceTimersByTimeAsync(300000);
			expect(global.fetch).toHaveBeenCalledTimes(3);
			expect(page.setCookie).toHaveBeenCalledTimes(2);
			expect(page.goto).toHaveBeenCalledTimes(1);
			await engine.stop();
			await jest.advanceTimersByTimeAsync(600000);
			expect(global.fetch).toHaveBeenCalledTimes(3);
			expect(close).toHaveBeenCalledTimes(1);
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("TDD-US4-CON012: browser shutdown aborts an in-flight presentation refresh", async () => {
		jest.useFakeTimers();
		const sessionId = "8b01b0e0-a941-4a3d-804b-823d2c5a54d5";
		let refreshSignal: AbortSignal | undefined;
		(global.fetch as jest.Mock).mockResolvedValueOnce(new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}` }), { status: 200, headers: { "set-cookie": `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict` } })).mockImplementationOnce(
			(_url: unknown, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					refreshSignal = init.signal as AbortSignal;
					refreshSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
				}),
		);
		const page = { goto: jest.fn().mockResolvedValue(undefined), setCookie: jest.fn().mockResolvedValue(undefined), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), waitForFunction: jest.fn().mockResolvedValue(undefined) };
		mockLaunch.mockResolvedValue({ newPage: jest.fn().mockResolvedValue(page), close: jest.fn().mockResolvedValue(undefined) });
		const options = Object.assign({ executionGeneration: "261e5175-a2d2-4c98-88fa-3e39df3f6323" }, { presentationSessionId: sessionId });
		const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "https://clipify.example", "token", options);
		engine.isRunning = true;
		try {
			await Reflect.get(engine, "startChromiumBackground").call(engine);
			await jest.advanceTimersByTimeAsync(300000);
			expect(refreshSignal?.aborted).toBe(false);
			await engine.stop();
			expect(refreshSignal?.aborted).toBe(true);
			expect(page.setCookie).toHaveBeenCalledTimes(1);
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("TDD-US2-FR008: a destination failure cannot overwrite the shared encoder status", async () => {
		const engine = new Engine("independent-status", "rtmp://127.0.0.1/live", "source", "key");
		engine.ffmpegStatus = "Encoder healthy";
		const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
		Reflect.get(engine, "monitorFFmpeg").call(engine, child, "Destination output", false);
		child.stderr.emit("data", Buffer.from("frame=1 fps=15 bitrate=500 kbits/s time=00:00:01\n"));
		child.emit("close", 1);
		expect(engine.ffmpegStatus).toBe("Encoder healthy");
		await engine.stop();
	});

	it("TDD-US2-CON006 U250: engine permission revocation fences destination reconnect before the next controller tick", async () => {
		jest.useFakeTimers();
		let permitted = true;
		const children: Array<ReturnType<typeof child>> = [];
		function child() {
			const process = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null as string | null, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: jest.fn() });
			process.kill.mockImplementation(() => {
				process.exitCode = 0;
				process.emit("close", 0);
				return true;
			});
			return process;
		}
		mockSpawn.mockImplementation(() => {
			const process = child();
			children.push(process);
			return process;
		});
		const engine = new Engine("fenced-recovery", "rtmp://127.0.0.1/live", "source", "key", 15, "720p", "24_7", "http://127.0.0.1", "", { mayOpenOutput: () => permitted, destinations: [{ id: "one", rtmpUrl: "rtmp://127.0.0.1/live", streamKey: "key" }] });
		try {
			await engine.start();
			const failedIndex = mockSpawn.mock.calls.findIndex(([, args]) => args.includes("copy"));
			const failed = children[failedIndex];
			failed.exitCode = 1;
			failed.emit("close", 1);
			permitted = false;
			await jest.advanceTimersByTimeAsync(1000);
			expect(mockSpawn.mock.calls.filter(([, args]) => args.includes("copy"))).toHaveLength(1);
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("TDD-US2-FR006: two selected destinations share one capture and encoder and receive the same encoded bytes", async () => {
		const children: Array<ReturnType<typeof child>> = [];
		function child() {
			const process = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null as string | null, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: jest.fn() });
			process.kill.mockImplementation(() => {
				process.exitCode = 0;
				process.emit("close", 0);
				return true;
			});
			return process;
		}
		mockSpawn.mockImplementation(() => {
			const process = child();
			children.push(process);
			return process;
		});
		const destinations = [
			{ id: "one", rtmpUrl: "rtmp://127.0.0.1/one", streamKey: "first-private" },
			{ id: "two", rtmpUrl: "rtmp://127.0.0.1/two", streamKey: "second-private" },
		];
		const engine = new Engine("multistream", "rtmp://127.0.0.1/one", "private-source", "first-private", 30, "720p", "24_7", "http://127.0.0.1", "private-token", { destinations } as ConstructorParameters<typeof Engine>[9]);
		try {
			await engine.start();
			expect(mockGetStream).toHaveBeenCalledTimes(1);
			const calls = mockSpawn.mock.calls;
			expect(calls.filter(([, args]) => args.includes("libx264"))).toHaveLength(1);
			const outputs = calls.map(([, args], index) => ({ args, process: children[index] })).filter(({ args }) => args.includes("copy"));
			expect(outputs).toHaveLength(2);
			const received = outputs.map(() => [] as Buffer[]);
			outputs.forEach((output, index) => output.process.stdin.on("data", (data) => received[index].push(data)));
			const encoder = children[calls.findIndex(([, args]) => args.includes("libx264"))];
			encoder.stdout.write(Buffer.from("same-encoded-packets"));
			expect(received.map((chunks) => Buffer.concat(chunks).toString())).toEqual(["same-encoded-packets", "same-encoded-packets"]);
			expect(Reflect.get(engine, "safeDiagnostic").call(engine, new Error("second-private first-private private-source"))).not.toMatch(/second-private|first-private|private-source/);
		} finally {
			await engine.stop();
		}
	});

	it("TDD-US2-CON005 U247: FFmpeg failure diagnostics never expose credential-bearing RTMP URLs", async () => {
		const engine = new Engine("diagnostic-source", "rtmp://127.0.0.1/live", "private-overlay-secret", "private-stream-key");
		const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
		const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			Reflect.get(engine, "monitorFFmpeg").call(engine, child, "Destination");
			child.stderr.emit("data", Buffer.from("Connection refused: rtmp://user:private-password@127.0.0.1:1935/live/private-stream-key?token=private-token\n"));
			child.emit("close", 1);
			expect(errorLog).toHaveBeenCalled();
			const text = JSON.stringify(errorLog.mock.calls);
			for (const secret of ["private-password", "private-stream-key", "private-token", "rtmp://user:"]) expect(text).not.toContain(secret);
			expect(text).toContain("Connection refused");
		} finally {
			errorLog.mockRestore();
			await engine.stop();
		}
	});

	it("TDD-US2-CON005 U247: a failed capture never logs or propagates credential-bearing process details", async () => {
		const engine = new Engine("capture-diagnostic", "rtmp://127.0.0.1/live", "private-overlay-secret", "private-stream-key");
		engine.isRunning = true;
		Reflect.set(engine, "page", {});
		const failure = Object.assign(new Error("capture failed for rtmp://user:private-password@127.0.0.1/live/private-stream-key"), { spawnargs: ["private-stream-key"] });
		mockGetStream.mockRejectedValueOnce(failure);
		const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const caught = await Reflect.get(engine, "startCloudLoopStream")
				.call(engine)
				.catch((error: unknown) => error);
			expect(caught).toBeInstanceOf(Error);
			const messages = [...errorLog.mock.calls.flat(), caught].map((value) => (value instanceof Error ? value.message + JSON.stringify({ ...value }) : String(value))).join("\n");
			for (const secret of ["private-password", "private-stream-key"]) expect(messages).not.toContain(secret);
			expect(messages).toContain("capture failed");
		} finally {
			errorLog.mockRestore();
			Reflect.set(engine, "page", null);
			await engine.stop();
		}
	});

	it("TDD-US2-CON005 U247: public startup errors preserve useful failure text without private overlay or Runner credentials", async () => {
		const engine = new Engine("navigation-diagnostic", "rtmp://127.0.0.1/live", "private-overlay-secret", "private-stream-key", 30, "720p", "24_7", "http://127.0.0.1", "private-runner-token");
		jest.useFakeTimers();
		mockLaunch.mockResolvedValue({ newPage: jest.fn().mockResolvedValue({ goto: jest.fn().mockRejectedValue(new Error("navigation failed: private-overlay-secret private-runner-token")), evaluateOnNewDocument: jest.fn() }), close: jest.fn().mockResolvedValue(undefined) });
		try {
			const starting = engine.start().catch((error: unknown) => error);
			await jest.advanceTimersByTimeAsync(4000);
			const caught = await starting;
			expect(caught).toBeInstanceOf(Error);
			const text = String(caught);
			expect(text).toContain("navigation failed");
			expect(text).not.toContain("private-overlay-secret");
			expect(text).not.toContain("private-runner-token");
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("24_7 mode should start Puppeteer and FFmpeg (Cloud Loop) immediately", async () => {
		const engine = new Engine("overlay-123", "rtmp://fake", "secret", "streamKey", 60, "1080p", "24_7", "http://api");
		await engine.start();

		// 1. Ensures dependencies
		expect(downloader.ensureDependencies).toHaveBeenCalled();

		// 2. Starts Puppeteer background
		expect(mockLaunch).toHaveBeenCalled();

		await engine.stop();

		// Current FFmpeg rejects this former input queue option before opening media.
		const encoderArgs = mockSpawn.mock.calls.find(([, args]) => args.includes("libx264"))![1];
		expect(encoderArgs.slice(0, encoderArgs.indexOf("-i"))).not.toContain("-thread_queue_size");

		// 3. Spawns Cloud Loop FFmpeg immediately
		expect(mockSpawn).toHaveBeenCalledWith("/mock/ffmpeg", expect.arrayContaining(["-i", "-", "-c:v", "libx264"]), expect.any(Object));
		expect(JSON.stringify((console.log as jest.Mock).mock.calls)).not.toContain("streamKey");
		expect(JSON.stringify((console.log as jest.Mock).mock.calls)).not.toContain("secret");
	});

	it("preserves the FFmpeg cause before the final generic line and redacts chunked credentials", () => {
		const engine = new Engine("diagnostic", "rtmp://private-host/live", "overlay-private", "key-private", 30, "720p", "24_7", "http://api", "runner-private");
		const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
		const errors = jest.spyOn(console, "error").mockImplementation(() => {});
		try {
			Reflect.get(engine, "monitorFFmpeg").call(engine, child, "Cloud Loop FFmpeg");
			child.stderr.emit("data", Buffer.from("x".repeat(20000)));
			child.stderr.emit("data", Buffer.from("\nSpecific input failure: key-pri"));
			child.stderr.emit("data", Buffer.from("vate overlay-private runner-private rtmp://private-host/live/key-private\nError opening input files: Invalid argument\n"));
			child.emit("close", 4294967274);
			const text = errors.mock.calls.flat().join("\n");
			expect(text).toContain("Specific input failure");
			expect(text).toContain("Error opening input files: Invalid argument");
			for (const secret of ["key-private", "overlay-private", "runner-private", "private-host"]) expect(text).not.toContain(secret);
			expect(text.length).toBeLessThan(9000);
		} finally {
			errors.mockRestore();
		}
	});

	it("reports encoder health, publishes previews and stops when the encoder unexpectedly closes", async () => {
		jest.useFakeTimers();
		const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, stdin: Object.assign(new EventEmitter(), { end: jest.fn() }), stderr: new EventEmitter(), kill: jest.fn() });
		child.kill.mockImplementation(() => {
			child.emit("close", 0);
			return true;
		});
		mockSpawn.mockReturnValueOnce(child);
		const engine = new Engine("health", "rtmp://fake", "secret", "", 30, "720p", "24_7", "https://api.invalid", "fixture-token");
		try {
			await engine.start();
			child.stderr.emit("data", Buffer.from("fps=30 bitrate=4500 kbits/s time=00:00:02\n"));
			expect(engine.ffmpegStatus).toContain("FPS: 30");
			expect(engine.ffmpegStatus).toContain("4500 kbits/s");
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue("fixture-preview");
			await jest.advanceTimersByTimeAsync(2000);
			expect(global.fetch).toHaveBeenCalledWith("https://api.invalid/api/runner/preview", expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer fixture-token" }, body: JSON.stringify({ overlayId: "health", image: "data:image/jpeg;base64,fixture-preview" }) }));
			(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
			await jest.advanceTimersByTimeAsync(2000);
			(fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
				throw new Error("locked");
			});
			await jest.advanceTimersByTimeAsync(2000);
			child.stdin.emit("error", Object.assign(new Error("closed"), { code: "EPIPE" }));
			child.stdin.emit("error", Object.assign(new Error("failed"), { code: "EIO" }));
			child.stderr.emit("data", Buffer.from("fatal encoder failure\n"));
			child.emit("close", 1);
			await engine.stop();
			expect(engine.isRunning).toBe(false);
			expect(engine.ffmpegStatus).toContain("Code:");
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("installs generation and invokes the correct overlay playback controls", async () => {
		const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
		const startRunnerPlayback = jest.fn(),
			startFallback = jest.fn(),
			stopFallback = jest.fn();
		const browserWindow = { startRunnerPlayback, startFallback, stopFallback };
		Reflect.set(globalThis, "window", browserWindow);
		const page = { goto: jest.fn().mockResolvedValue(undefined), evaluateOnNewDocument: jest.fn(async (callback, ...args) => callback(...args)), evaluate: jest.fn(async (callback, ...args) => callback(...args)) };
		const close = jest.fn().mockResolvedValue(undefined);
		mockLaunch.mockResolvedValue({ newPage: async () => page, close });
		const manual = new Engine("playback", "rtmp://fake", "secret", "", 30, "720p", "24_7", "https://api.invalid", "", { executionGeneration: "generation" });
		const fallback = new Engine("fallback", "rtmp://fake", "secret", "", 30, "720p", "failsafe", "https://api.invalid");
		try {
			await manual.start();
			expect(browserWindow).toHaveProperty("__clipifyRunnerExecution.generation", "generation");
			expect(startRunnerPlayback).toHaveBeenCalledTimes(1);
			await manual.stop();
			await fallback.start();
			proxyEvents.emit("obsConnected");
			await (fallback as unknown as { transitionPromise: Promise<void> }).transitionPromise;
			expect(stopFallback).toHaveBeenCalledTimes(1);
			proxyEvents.emit("obsDisconnected");
			await (fallback as unknown as { transitionPromise: Promise<void> }).transitionPromise;
			expect(startFallback).toHaveBeenCalledTimes(1);
		} finally {
			await manual.stop();
			await fallback.stop();
			if (previous) Object.defineProperty(globalThis, "window", previous);
			else Reflect.deleteProperty(globalThis, "window");
		}
	});

	it("does not echo FFmpeg stderr credentials on abnormal exit", async () => {
		const stderr = new EventEmitter();
		const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
		child.stderr = stderr;
		const error = jest.spyOn(console, "error").mockImplementation(() => {});
		const engine = new Engine("overlay-123", "rtmp://fake", "overlay-secret", "stream-key", 60, "1080p", "24_7", "http://api");
		(engine as unknown as { monitorFFmpeg: (child: unknown, name: string) => void }).monitorFFmpeg(child, "FFmpeg");
		stderr.emit("data", Buffer.from("Failed with secret=overlay-secret stream-key\n"));
		child.emit("close", 1);
		expect(JSON.stringify(error.mock.calls)).not.toContain("overlay-secret");
		expect(JSON.stringify(error.mock.calls)).not.toContain("stream-key");
	});

	it("does not expose the secret when overlay navigation fails", async () => {
		mockLaunch.mockResolvedValue({ newPage: jest.fn().mockResolvedValue({ goto: jest.fn().mockRejectedValue(new Error("Navigation to http://api/overlay/overlay-123?secret=overlay-secret failed")), evaluateOnNewDocument: jest.fn() }), close: jest.fn() });
		const engine = new Engine("overlay-123", "rtmp://fake", "overlay-secret", "stream-key", 60, "1080p", "24_7", "http://api");
		await expect(engine.start()).rejects.toThrow("Navigation to http://api/overlay/overlay-123?secret=[redacted] failed");
		expect(JSON.stringify((console.log as jest.Mock).mock.calls)).not.toContain("overlay-secret");
	});

	it("does not spawn a stream when dependency installation fails", async () => {
		(downloader.ensureDependencies as jest.Mock).mockRejectedValueOnce(new Error("FFmpeg download failed"));
		const engine = new Engine("overlay-123", "rtmp://fake", "secret", "streamKey", 60, "1080p", "24_7", "http://api");

		await expect(engine.start()).rejects.toThrow("FFmpeg download failed");
		expect(mockLaunch).not.toHaveBeenCalled();
		expect(mockSpawn).not.toHaveBeenCalled();
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

	it("retries a transient Chromium launch failure before starting output", async () => {
		jest.useFakeTimers();
		const page = { goto: jest.fn().mockResolvedValue(null), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), evaluate: jest.fn().mockResolvedValue(true) };
		const close = jest.fn().mockResolvedValue(null);
		mockLaunch.mockRejectedValueOnce(new Error("Target closed")).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close });
		const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
		const engine = new Engine("launch-retry", "rtmp://fake", "secret", "streamKey", 30, "720p", "24_7", "http://api");
		try {
			const starting = engine.start();
			await jest.advanceTimersByTimeAsync(2000);
			await expect(starting).resolves.toBeUndefined();
			expect(mockLaunch).toHaveBeenCalledTimes(2);
			expect(mockSpawn).toHaveBeenCalled();
			expect(warning).toHaveBeenCalledWith("[Engine] Chromium startup attempt 1/3 failed; retrying...");
		} finally {
			warning.mockRestore();
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("retries Chromium startup with a fresh browser when initial navigation loses its frame", async () => {
		jest.useFakeTimers();
		const firstClose = jest.fn().mockResolvedValue(null);
		const secondClose = jest.fn().mockResolvedValue(null);
		const readyPage = { goto: jest.fn().mockResolvedValue(null), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), evaluate: jest.fn().mockResolvedValue(true) };
		mockLaunch.mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue({ ...readyPage, goto: jest.fn().mockRejectedValue(new Error("Navigating frame was detached")) }), close: firstClose }).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(readyPage), close: secondClose });
		const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
		const engine = new Engine("navigation-retry", "rtmp://fake", "secret", "streamKey", 30, "720p", "24_7", "http://api");
		try {
			const starting = engine.start();
			await jest.advanceTimersByTimeAsync(2000);
			await expect(starting).resolves.toBeUndefined();
			expect(mockLaunch).toHaveBeenCalledTimes(2);
			expect(firstClose).toHaveBeenCalledTimes(1);
			expect(mockSpawn).toHaveBeenCalled();
			expect(warning).toHaveBeenCalledWith("[Engine] Chromium startup attempt 1/3 failed; retrying...");
		} finally {
			warning.mockRestore();
			await engine.stop();
			expect(secondClose).toHaveBeenCalledTimes(1);
			jest.useRealTimers();
		}
	});

	it("retries failed capture with a fresh browser and surfaces exhaustion without opening an encoder", async () => {
		jest.useFakeTimers();
		const engine = new Engine("capture-retry", "rtmp://fake", "secret", "");
		mockGetStream.mockRejectedValue(new Error("capture unavailable"));
		try {
			const starting = engine.start();
			const failed = expect(starting).rejects.toThrow("capture unavailable");
			await jest.advanceTimersByTimeAsync(10000);
			await failed;
			expect(mockGetStream).toHaveBeenCalledTimes(3);
			expect(mockLaunch).toHaveBeenCalledTimes(3);
			expect(mockSpawn).not.toHaveBeenCalled();
			expect(engine.ffmpegStatus).toBe("Capture startup failed 🔴");
		} finally {
			mockGetStream.mockResolvedValue({ pipe: jest.fn(), destroy: jest.fn() });
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("a stalled capture attempt times out before a later attempt succeeds", async () => {
		jest.useFakeTimers();
		const engine = new Engine("capture-timeout", "rtmp://fake", "secret", "");
		mockGetStream.mockImplementationOnce(() => new Promise(() => {}));
		try {
			const starting = engine.start();
			await jest.advanceTimersByTimeAsync(20000);
			await starting;
			expect(mockGetStream).toHaveBeenCalledTimes(2);
			expect(mockSpawn).toHaveBeenCalledTimes(1);
		} finally {
			await engine.stop();
			jest.useRealTimers();
		}
	});

	it("denied execution permission prevents dependency setup and all media output", async () => {
		const engine = new Engine("denied", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "token", { mayOpenOutput: () => false });
		await engine.start();
		expect(downloader.ensureDependencies).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
		expect(mockSpawn).not.toHaveBeenCalled();
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
	it("TDD-US1-FR004 generation bridge: install the captured generation before any player navigation", async () => {
		const engine = new Engine("generation-source", "rtmp://fake", "source-secret", "stream-key", 15, "720p", "24_7", "http://api", "device-token", { executionGeneration: "captured-generation" });
		try {
			await engine.start();
			const browser = await mockLaunch.mock.results[0].value,
				page = await browser.newPage.mock.results[0].value;
			expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(expect.any(Function), "captured-generation");
			expect(page.evaluateOnNewDocument.mock.invocationCallOrder[0]).toBeLessThan(page.goto.mock.invocationCallOrder[0]);
		} finally {
			await engine.stop();
		}
	});

	test("TDD-US1-FR004: Stop during dependency preparation cannot launch a late browser or encoder", async () => {
		let ready: ((deps: { chromePath: string; ffmpegPath: string }) => void) | undefined;
		(downloader.ensureDependencies as jest.Mock).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					ready = resolve;
				}),
		);
		const launchBefore = (launch as jest.Mock).mock.calls.length;
		const spawnBefore = (spawn as jest.Mock).mock.calls.length;
		const engine = new Engine("pending", "rtmp://127.0.0.1/live", "secret", "");
		const starting = engine.start();
		await engine.stop();
		ready?.({ chromePath: "/mock/chrome", ffmpegPath: "/mock/ffmpeg" });
		await starting;
		expect((launch as jest.Mock).mock.calls).toHaveLength(launchBefore);
		expect((spawn as jest.Mock).mock.calls).toHaveLength(spawnBefore);
		expect(engine.isRunning).toBe(false);
	});

	test("TDD-US1-FR004: a browser launch completing after Stop is closed before page or capture setup", async () => {
		let launched: ((browser: unknown) => void) | undefined;
		const close = jest.fn().mockResolvedValue(undefined),
			newPage = jest.fn().mockResolvedValue({ evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), goto: jest.fn().mockResolvedValue(undefined), evaluate: jest.fn().mockResolvedValue(true) });
		(launch as jest.Mock).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					launched = resolve;
				}),
		);
		const engine = new Engine("pending-browser", "rtmp://127.0.0.1/live", "secret", "");
		const starting = engine.start();
		await Promise.resolve();
		await Promise.resolve();
		expect(launch).toHaveBeenCalledTimes(1);
		await engine.stop();
		launched?.({ close, newPage });
		await starting;
		expect(close).toHaveBeenCalledTimes(1);
		expect(newPage).not.toHaveBeenCalled();
		expect(getStream).not.toHaveBeenCalled();
	});

	test("TDD-US1-FR004: a closed execution instance cannot be started again", async () => {
		const engine = new Engine("terminal", "rtmp://127.0.0.1/live", "secret", "");
		await engine.start();
		await engine.stop();
		const launches = (launch as jest.Mock).mock.calls.length,
			encoders = (spawn as jest.Mock).mock.calls.length;
		await engine.start();
		expect(engine.isRunning).toBe(false);
		expect((launch as jest.Mock).mock.calls).toHaveLength(launches);
		expect((spawn as jest.Mock).mock.calls).toHaveLength(encoders);
	});
	test("TDD-US1-FR004: capture arriving after completed Stop is destroyed without opening an encoder", async () => {
		let captured: ((stream: unknown) => void) | undefined;
		const stream = { pipe: jest.fn(), destroy: jest.fn() };
		(getStream as jest.Mock).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					captured = resolve;
				}),
		);
		const engine = new Engine("late-capture", "rtmp://127.0.0.1/live", "secret", "");
		const starting = engine.start();
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(getStream).toHaveBeenCalledTimes(1);
		await engine.stop();
		captured?.(stream);
		await starting;
		expect(spawn).not.toHaveBeenCalled();
		expect(stream.pipe).not.toHaveBeenCalled();
		expect(stream.destroy).toHaveBeenCalledTimes(1);
	});

	test("TDD-US1-FR004: Stop during playback activation cannot spawn a late encoder", async () => {
		let activated: ((ready: boolean) => void) | undefined;
		const stream = { pipe: jest.fn(), destroy: jest.fn() };
		(getStream as jest.Mock).mockResolvedValueOnce(stream);
		const page = {
			goto: jest.fn().mockResolvedValue(undefined),
			evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
			evaluate: jest.fn(
				() =>
					new Promise((resolve) => {
						activated = resolve;
					}),
			),
		};
		(launch as jest.Mock).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close: jest.fn().mockResolvedValue(undefined) });
		const engine = new Engine("late-playback", "rtmp://127.0.0.1/live", "secret", "");
		const starting = engine.start().catch((error) => error);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(page.evaluate).toHaveBeenCalledTimes(1);
		await engine.stop();
		activated?.(true);
		await starting;
		expect(spawn).not.toHaveBeenCalled();
		expect(stream.pipe).not.toHaveBeenCalled();
	});

	test("TDD-US1-DEC001: lease permission expiring during capture setup prevents encoder creation before the next tick", async () => {
		let captured: ((stream: unknown) => void) | undefined,
			permitted = true;
		const stream = { pipe: jest.fn(), destroy: jest.fn() };
		(getStream as jest.Mock).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					captured = resolve;
				}),
		);
		const engine = new Engine("lease-gate", "rtmp://127.0.0.1/live", "secret", "", 15, "720p", "24_7", "http://127.0.0.1", "", { mayOpenOutput: () => permitted });
		try {
			const starting = engine.start();
			await new Promise<void>((resolve) => setImmediate(resolve));
			permitted = false;
			captured?.(stream);
			await starting;
			expect(spawn).not.toHaveBeenCalled();
			expect(stream.pipe).not.toHaveBeenCalled();
			expect(stream.destroy).toHaveBeenCalledTimes(1);
		} finally {
			await engine.stop();
		}
	});
});

test("TDD-US3-OPT039: the native signed end is mapped conservatively into the player clock before navigation", async () => {
	let nativeNow = 10000;
	const page = {
		goto: jest.fn().mockResolvedValue(undefined),
		evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
		evaluate: jest.fn(async () => {
			nativeNow = 10020;
			return 5000;
		}),
	};
	const close = jest.fn().mockResolvedValue(undefined);
	(launch as jest.Mock).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close });
	const options = { executionGeneration: "scheduled-clock", scheduledDeadlineMonotonic: 50000, now: () => nativeNow };
	const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "http://api", "token", options);
	engine.isRunning = true;
	try {
		await Reflect.get(engine, "startChromiumBackground").call(engine);
		expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(expect.any(Function), 44980);
		expect(page.evaluateOnNewDocument.mock.invocationCallOrder.at(-1)).toBeLessThan(page.goto.mock.invocationCallOrder[0]);
	} finally {
		await engine.stop();
	}
});

test.each([30000, 90000])("TDD-US3-OPT039 / TDD-US3-EC010: a replaced deadline %i survives a new player document without accumulating old boundaries", async (deadline) => {
	const previousWindow = Reflect.get(globalThis, "window");
	const scripts = new Map<string, { fn: (...args: unknown[]) => unknown; args: unknown[] }>();
	let serial = 0,
		nativeNow = 10000;
	const navigate = async () => {
		Reflect.set(globalThis, "window", {});
		for (const script of scripts.values()) script.fn(...script.args);
	};
	const page = {
		goto: jest.fn(navigate),
		evaluateOnNewDocument: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
			const identifier = "script-" + ++serial;
			scripts.set(identifier, { fn, args });
			return { identifier };
		}),
		removeScriptToEvaluateOnNewDocument: jest.fn(async (identifier: string) => {
			scripts.delete(identifier);
		}),
		evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
			if (!args.length) {
				nativeNow = 10020;
				return 5000;
			}
			return fn(...args);
		}),
	};
	const close = jest.fn().mockResolvedValue(undefined);
	(launch as jest.Mock).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close });
	const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "http://api", "token", { executionGeneration: "reload-generation", scheduledDeadlineMonotonic: 50000, now: () => nativeNow });
	engine.isRunning = true;
	try {
		await Reflect.get(engine, "startChromiumBackground").call(engine);
		await engine.updateScheduledDeadline(deadline);
		await page.goto();
		const execution = Reflect.get(globalThis, "window").__clipifyRunnerExecution;
		if (!execution || typeof execution.deadlineMonotonic !== "number") throw new Error("BOOTSTRAP_SNAPSHOT_MISSING");
		expect(execution.generation).toBe("reload-generation");
		expect(execution.deadlineMonotonic + performance.timeOrigin).toBeCloseTo(deadline - 5020, 3);
		await engine.updateScheduledDeadline(deadline + 1000);
		await page.goto();
		const replaced = Reflect.get(globalThis, "window").__clipifyRunnerExecution;
		if (!replaced || typeof replaced.deadlineMonotonic !== "number") throw new Error("REPLACED_BOOTSTRAP_SNAPSHOT_MISSING");
		expect(replaced.deadlineMonotonic + performance.timeOrigin).toBeCloseTo(deadline - 4020, 3);
		expect(scripts.size).toBe(2);
	} finally {
		await engine.stop();
		if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
		else Reflect.set(globalThis, "window", previousWindow);
	}
});

test("TDD-US3-OPT039: a nonfinite replacement deadline is rejected before browser or output side effects", async () => {
	const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "http://api", "token");
	await expect(engine.updateScheduledDeadline(NaN)).rejects.toThrow("Invalid execution deadline");
	expect(engine.isRunning).toBe(false);
	await engine.stop();
});
test("TDD-US3-OPT039 / TDD-US3-OPT088: a deadline replaced before browser startup is installed in its first document", async () => {
	let now = 10000;
	const page = {
		goto: jest.fn().mockResolvedValue(undefined),
		evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
		evaluate: jest.fn(async () => {
			now = 10020;
			return 5000;
		}),
	};
	const close = jest.fn().mockResolvedValue(undefined);
	(launch as jest.Mock).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close });
	const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "http://api", "token", { executionGeneration: "starting-deadline", scheduledDeadlineMonotonic: 50000, now: () => now });
	try {
		await engine.updateScheduledDeadline(30000);
		engine.isRunning = true;
		await Reflect.get(engine, "startChromiumBackground").call(engine);
		expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(expect.any(Function), 24980);
	} finally {
		await engine.stop();
	}
});
test("TDD-US3-OPT039: a live deadline update cannot overwrite a different execution generation", async () => {
	const previous = Reflect.get(globalThis, "window"),
		foreign = { generation: "foreign-generation" };
	Reflect.set(globalThis, "window", { __clipifyRunnerExecution: foreign });
	const page = { evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined), evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)) };
	const engine = new Engine("source", "rtmp://fake", "secret", "", 15, "720p", "24_7", "http://api", "token", { executionGeneration: "owned-generation", now: () => 1000 });
	Reflect.set(engine, "page", page);
	try {
		await expect(engine.updateScheduledDeadline(30000)).rejects.toThrow("Execution generation changed");
		expect(Reflect.get(globalThis, "window").__clipifyRunnerExecution).toEqual(foreign);
	} finally {
		await engine.stop();
		if (previous === undefined) Reflect.deleteProperty(globalThis, "window");
		else Reflect.set(globalThis, "window", previous);
	}
});

test("TDD-US4-CON012 / TDD-US4-DEC012: a modern Runner authenticates before navigation and waits for a usable measured layout", async () => {
	const sessionId = "8b01b0e0-a941-4a3d-804b-823d2c5a54d5";
	const generation = "261e5175-a2d2-4c98-88fa-3e39df3f6323";
	const previousFetch = global.fetch;
	const previousWindow = Reflect.get(globalThis, "window"),
		previousDocument = Reflect.get(globalThis, "document");
	const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}`, expiresAt: 1600000 }), { status: 200, headers: { "set-cookie": `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict` } }));
	global.fetch = fetcher;
	const page = { goto: jest.fn().mockResolvedValue(undefined), setCookie: jest.fn().mockResolvedValue(undefined), waitForFunction: jest.fn().mockResolvedValue(undefined), evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined) };
	const close = jest.fn().mockResolvedValue(undefined);
	(launch as jest.Mock).mockResolvedValueOnce({ newPage: jest.fn().mockResolvedValue(page), close });
	const options = Object.assign({ executionGeneration: generation }, { presentationSessionId: sessionId });
	const engine = new Engine("source", "rtmp://fake", "private-overlay-secret", "", 15, "720p", "24_7", "https://clipify.example", "private-runner-token", options);
	engine.isRunning = true;
	try {
		await Reflect.get(engine, "startChromiumBackground").call(engine);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(page.setCookie).toHaveBeenCalledWith(expect.objectContaining({ name: "clipify_runner_presentation", value: "signed-credential", path: `/runner/presentation/${sessionId}`, httpOnly: true }));
		expect(page.goto).toHaveBeenCalledWith(`https://clipify.example/runner/presentation/${sessionId}`, { waitUntil: "networkidle2" });
		expect(page.setCookie.mock.invocationCallOrder[0]).toBeLessThan(page.goto.mock.invocationCallOrder[0]);
		expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), { timeout: 15000 }, generation);
		expect(page.goto.mock.invocationCallOrder[0]).toBeLessThan(page.waitForFunction.mock.invocationCallOrder[0]);
		const ready = page.waitForFunction.mock.calls[0][0] as (expected: string) => boolean;
		let renderedGeneration = generation,
			bridgeGeneration = generation;
		let layoutStatus = "pending";
		const marker = { getAttribute: (name: string) => (name === "data-runner-layout-status" ? layoutStatus : renderedGeneration) };
		const querySelector = jest.fn(() => marker as typeof marker | null);
		const rendererWindow = { clipifyRunnerPresentation: { snapshot: () => ({ generation: bridgeGeneration }) } };
		Reflect.set(globalThis, "document", { querySelector });
		Reflect.set(globalThis, "window", rendererWindow);
		expect(ready(generation)).toBe(false);
		layoutStatus = "blocked";
		expect(ready(generation)).toBe(false);
		layoutStatus = "placed";
		expect(ready(generation)).toBe(true);
		layoutStatus = "clean";
		expect(ready(generation)).toBe(true);
		layoutStatus = "missing";
		expect(ready(generation)).toBe(false);
		layoutStatus = "placed";
		renderedGeneration = "foreign-generation";
		expect(ready(generation)).toBe(false);
		renderedGeneration = generation;
		bridgeGeneration = "foreign-generation";
		expect(ready(generation)).toBe(false);
		bridgeGeneration = generation;
		querySelector.mockReturnValue(null);
		expect(ready(generation)).toBe(false);
		querySelector.mockReturnValue(marker);
		Reflect.set(rendererWindow, "clipifyRunnerPresentation", undefined);
		expect(ready(generation)).toBe(false);
	} finally {
		await engine.stop();
		global.fetch = previousFetch;
		if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
		else Reflect.set(globalThis, "window", previousWindow);
		if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
		else Reflect.set(globalThis, "document", previousDocument);
	}
});
