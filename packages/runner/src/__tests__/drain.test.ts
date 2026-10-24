import { Engine } from "../engine";
import { createPlaybackDrain } from "../presentation";
jest.mock("puppeteer-stream", () => ({ launch: jest.fn(), getStream: jest.fn() }));
jest.mock("../downloader", () => ({ ensureDependencies: jest.fn() }));

test("graceful capture shutdown flushes the recorder's final chunk before ending encoder input", async () => {
	const { PassThrough, Writable } = await import("node:stream");
	const { EventEmitter } = await import("node:events");
	const chunks: string[] = [];
	const stdin = new Writable({
		write(chunk, _encoding, done) {
			chunks.push(chunk.toString());
			done();
		},
	});
	const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: jest.fn(), stdin });
	stdin.on("finish", () => child.emit("close", 0));
	const capture = Object.assign(new PassThrough(), {
		stop: jest.fn(async () => {
			capture.end("final-clip-frame");
		}),
	});
	capture.pipe(stdin);
	capture.write("clip-head");
	const engine = new Engine("final-capture-chunk", "rtmp://fake", "secret", "");
	const state = engine as unknown as { mediaStream: unknown; ffmpeg: unknown };
	state.mediaStream = capture;
	state.ffmpeg = child;
	engine.isRunning = true;
	await engine.stop(true, 1000);
	expect(capture.stop).toHaveBeenCalledTimes(1);
	expect(chunks).toEqual(["clip-head", "final-clip-frame"]);
	expect(child.kill).not.toHaveBeenCalled();
});

test.each(["reject", "stall"])("a recorder stop that %s cannot extend the output closure budget", async (failure) => {
	jest.useFakeTimers();
	const { PassThrough, Writable } = await import("node:stream");
	const { EventEmitter } = await import("node:events");
	const stdin = new Writable({
		write(_chunk, _encoding, done) {
			done();
		},
	});
	const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: jest.fn(), stdin });
	stdin.on("finish", () => child.emit("close", 0));
	const capture = Object.assign(new PassThrough(), { stop: jest.fn(() => (failure === "reject" ? Promise.reject(new Error("recorder unavailable")) : new Promise<void>(() => {}))) });
	capture.pipe(stdin);
	const engine = new Engine("capture-close-budget", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { mediaStream: unknown; ffmpeg: unknown };
	state.mediaStream = capture;
	state.ffmpeg = child;
	engine.isRunning = true;
	try {
		const stopping = engine.stop(true, 1000);
		await jest.advanceTimersByTimeAsync(1000);
		await stopping;
		expect(capture.stop).toHaveBeenCalledTimes(1);
		expect(capture.destroyed).toBe(true);
		expect(stdin.writableEnded).toBe(true);
	} finally {
		child.emit("close");
		await engine.stop();
		jest.useRealTimers();
	}
});

test("presentation failures remain bounded by the no-progress deadline and never report closure early", async () => {
	jest.useFakeTimers();
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("unavailable-player", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn().mockRejectedValue(new Error("browser disconnected")) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(59750);
		expect(close).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(250);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.isRunning).toBe(false);
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});

test("graceful encoder flush escalates at its deadline but still requires a real close event", async () => {
	jest.useFakeTimers();
	const { EventEmitter } = await import("node:events");
	const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: jest.fn(), stdin: { end: jest.fn() } });
	const engine = new Engine("flush-timeout", "rtmp://fake", "secret", "");
	(engine as unknown as { ffmpeg: unknown }).ffmpeg = child;
	engine.isRunning = true;
	let closed = false;
	try {
		const stopping = engine.stop(true, 1000).then(() => {
			closed = true;
		});
		await jest.advanceTimersByTimeAsync(1000);
		expect(child.stdin.end).toHaveBeenCalledTimes(1);
		expect(child.kill).toHaveBeenCalledWith("SIGKILL");
		expect(closed).toBe(false);
		child.emit("close", null, "SIGKILL");
		await stopping;
		expect(closed).toBe(true);
	} finally {
		child.emit("close");
		await engine.stop();
		jest.useRealTimers();
	}
});

test("an unresponsive encoder is force-killed after the emergency grace period", async () => {
	jest.useFakeTimers();
	const { EventEmitter } = await import("node:events");
	const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: jest.fn(), stdin: { end: jest.fn() } });
	const engine = new Engine("force-kill", "rtmp://fake", "secret", "");
	(engine as unknown as { obsForwarder: unknown }).obsForwarder = child;
	engine.isRunning = true;
	try {
		const stopping = engine.stop();
		await jest.advanceTimersByTimeAsync(5000);
		expect(child.kill.mock.calls).toEqual([["SIGINT"], ["SIGKILL"]]);
		child.emit("close");
		await stopping;
	} finally {
		child.emit("close");
		await engine.stop();
		jest.useRealTimers();
	}
});

test("TDD-US1-FR004: pending clip drain keeps the engine alive until the current clip reports completion", async () => {
	jest.useFakeTimers();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	let phase = "playing";
	const close = jest.fn().mockResolvedValue(undefined);
	const bridge = {
		requestDrain: () => {
			phase = "draining";
			return bridge.snapshot();
		},
		snapshot: () => ({ state: phase, generation: "legacy", clips: [{ id: "current", time: 1, duration: 3, started: true, ended: phase === "drained" }] }),
		notifyEnded: () => {
			phase = "drained";
		},
	};
	Reflect.set(globalThis, "window", { clipifyRunnerPresentation: bridge });
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "source-secret", "", 15, "720p");
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const controller = engine as Engine & { requestDrain?: () => Promise<void> };
		const stopped = controller.requestDrain ? controller.requestDrain() : engine.stop();
		await Promise.resolve();
		await Promise.resolve();
		expect(engine.isRunning).toBe(true);
		expect(close).not.toHaveBeenCalled();
		bridge.notifyEnded();
		await jest.advanceTimersByTimeAsync(1000);
		await stopped;
		expect(engine.isRunning).toBe(false);
		expect(close).toHaveBeenCalledTimes(1);
	} finally {
		await engine.stop();
		jest.useRealTimers();
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

test("TDD-US1-FR004: simultaneous Stop callers both await the same physical browser closure", async () => {
	let closed: (() => void) | undefined;
	const browser = {
		close: jest.fn(
			() =>
				new Promise<void>((resolve) => {
					closed = resolve;
				}),
		),
	};
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "");
	(engine as unknown as { browser: unknown }).browser = browser;
	engine.isRunning = true;
	let firstDone = false,
		secondDone = false;
	const first = engine.stop().then(() => {
		firstDone = true;
	});
	await Promise.resolve();
	await Promise.resolve();
	const second = engine.stop().then(() => {
		secondDone = true;
	});
	await Promise.resolve();
	await Promise.resolve();
	expect(browser.close).toHaveBeenCalledTimes(1);
	expect(firstDone).toBe(false);
	expect(secondDone).toBe(false);
	closed?.();
	await Promise.all([first, second]);
	expect(firstDone).toBe(true);
	expect(secondDone).toBe(true);
});

test("TDD-US1-FR004: a previously signalled encoder is not closed until its close event", async () => {
	const { EventEmitter } = await import("node:events");
	const child = Object.assign(new EventEmitter(), { killed: true, exitCode: null, signalCode: null, kill: jest.fn(), stdin: { end: jest.fn() } });
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "");
	(engine as unknown as { ffmpeg: unknown }).ffmpeg = child;
	engine.isRunning = true;
	let completed = false;
	const stopped = engine.stop().then(() => {
		completed = true;
	});
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(completed).toBe(false);
	child.emit("close", null, "SIGKILL");
	await stopped;
	expect(completed).toBe(true);
});

test("TDD-US1-FR004: graceful request arriving during emergency cleanup waits for output closure", async () => {
	let closed: (() => void) | undefined;
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "");
	(engine as unknown as { browser: unknown }).browser = {
		close: () =>
			new Promise<void>((resolve) => {
				closed = resolve;
			}),
	};
	engine.isRunning = true;
	const emergency = engine.stop();
	await new Promise<void>((resolve) => setImmediate(resolve));
	let drainCompleted = false;
	const drain = engine.requestDrain().then(() => {
		drainCompleted = true;
	});
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(drainCompleted).toBe(false);
	closed?.();
	await Promise.all([emergency, drain]);
	expect(drainCompleted).toBe(true);
});

describe("TDD-US1-FR004: bounded graceful shutdown", () => {
	test.each([
		{ name: "stalled playback", limit: 60000, advancing: false, generation: "execution" },
		{ name: "wrong-generation playback", limit: 60000, advancing: true, generation: "other" },
		{ name: "continuously progressing long clip", limit: 300000, advancing: true, generation: "execution" },
		{ name: "stricter lease deadline", limit: 12000, advancing: true, generation: "execution", deadline: 12000 },
	])("$name closes at the enforced deadline", async ({ limit, advancing, generation, deadline }) => {
		jest.useFakeTimers();
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
		const snapshot = () => ({ generation, state: "draining", clips: [{ id: "current", time: advancing ? performance.now() / 1000 : 1, duration: 900, started: true, ended: false }] });
		Reflect.set(globalThis, "window", { clipifyRunnerPresentation: { requestDrain: snapshot, snapshot } });
		const close = jest.fn().mockResolvedValue(undefined);
		const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "", 15, "720p", "24_7", "http://127.0.0.1", "", { executionGeneration: "execution", now: () => performance.now() });
		Object.assign(engine, { page: { evaluate: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }, browser: { close }, isRunning: true });
		try {
			const stopped = engine.requestDrain({ deadlineMonotonic: deadline });
			await jest.advanceTimersByTimeAsync(limit - 1);
			expect(close).not.toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(1);
			await stopped;
			expect(close).toHaveBeenCalledTimes(1);
			expect(engine.isRunning).toBe(false);
		} finally {
			await engine.stop();
			jest.useRealTimers();
			if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
			else Reflect.deleteProperty(globalThis, "window");
		}
	});
});

test("TDD-US1-FR004: live forwarding output closes before waiting for a stalled browser shutdown", async () => {
	const { EventEmitter } = await import("node:events");
	let releaseBrowser: (() => void) | undefined,
		outputClosed = false;
	const child = Object.assign(new EventEmitter(), {
		killed: false,
		exitCode: null,
		signalCode: null,
		kill: jest.fn(() => {
			outputClosed = true;
			child.emit("close", 0);
			return true;
		}),
	});
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "", 15, "720p", "failsafe");
	Object.assign(engine, {
		isRunning: true,
		isForwardingObs: true,
		obsForwarder: child,
		browser: {
			close: () =>
				new Promise<void>((resolve) => {
					releaseBrowser = resolve;
				}),
		},
	});
	const stopped = engine.requestDrain();
	try {
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(outputClosed).toBe(true);
		expect(child.kill).toHaveBeenCalledTimes(1);
	} finally {
		releaseBrowser?.();
		await stopped;
	}
});

test("TDD-US3-CON010 U206/U207; TDD-US3-OPT076 U116: no-progress drain preserves playback until 60 seconds and reports its timeout", async () => {
	jest.useFakeTimers();
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("scheduled-no-progress", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown; drainOutcome?: string };
	state.page = { evaluate: jest.fn().mockResolvedValue({ generation: "legacy", state: "draining", clips: [{ id: "current", time: 1, duration: 120, started: true, ended: false }], pendingClipIds: ["current"] }) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(59999);
		expect(engine.isRunning).toBe(true);
		expect(close).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.isRunning).toBe(false);
		expect(state.drainOutcome).toBe("playback_timeout");
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});

test("TDD-US3-CON010 U208/U209; TDD-US3-OPT077 U117: progressing playback survives 299999 ms but cannot exceed five minutes", async () => {
	jest.useFakeTimers();
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("scheduled-overrun", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown; drainOutcome?: string };
	state.page = { evaluate: jest.fn(async () => ({ generation: "legacy", state: "draining", clips: [{ id: "current", time: performance.now() / 1000, duration: 600, started: true, ended: false }], pendingClipIds: ["current"] })) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(299999);
		expect(engine.isRunning).toBe(true);
		expect(close).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.isRunning).toBe(false);
		expect(state.drainOutcome).toBe("playback_timeout");
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});

test("TDD-US3-EC009: an unresponsive presentation RPC cannot bypass the no-progress watchdog", async () => {
	jest.useFakeTimers();
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("hung-presentation", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn(() => new Promise(() => {})) };
	state.browser = { close };
	engine.isRunning = true;
	let completed = false;
	try {
		void engine.requestDrain().then(() => {
			completed = true;
		});
		await jest.advanceTimersByTimeAsync(60000);
		expect(close).toHaveBeenCalledTimes(1);
		expect(completed).toBe(true);
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});

test("TDD-US3-EC009: stopping a live OBS forwarder does not misreport a generated-playback timeout", async () => {
	const engine = new Engine("live-source", "rtmp://fake", "secret", "", 30, "720p", "failsafe");
	(engine as unknown as { isForwardingObs: boolean }).isForwardingObs = true;
	engine.isRunning = true;
	await engine.requestDrain();
	expect(engine.isRunning).toBe(false);
	expect(engine.drainOutcome).toBeNull();
});

test("TDD-US3-CON010 U262: a retired generation completion cannot close its replacement engine", async () => {
	jest.useFakeTimers();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const clips = () => [{ id: "a", time: 5, duration: 30, started: true, ended: false }];
	const retired = createPlaybackDrain({ generation: "retired", readClips: clips, preventNext: jest.fn() });
	const current = createPlaybackDrain({ generation: "replacement", readClips: clips, preventNext: jest.fn() });
	retired.requestDrain("retired");
	Reflect.set(globalThis, "window", { clipifyRunnerPresentation: current });
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("replacement-source", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { executionGeneration: "replacement", now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(250);
		retired.notifyEnded("a");
		await jest.advanceTimersByTimeAsync(250);
		expect(retired.snapshot().state).toBe("drained");
		expect(current.snapshot().state).toBe("draining");
		expect(engine.isRunning).toBe(true);
		expect(close).not.toHaveBeenCalled();
		current.notifyEnded("a");
		await jest.advanceTimersByTimeAsync(250);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.drainOutcome).toBe("clip_completed");
	} finally {
		await engine.stop();
		jest.useRealTimers();
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

test("TDD-US3-FR013 U13; TDD-US3-OPT040 U80; TDD-US3-CON010 U146: the 22:00 end waits for a progressing current clip until its 22:01 boundary", async () => {
	jest.useFakeTimers();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const player = createPlaybackDrain({ generation: "scheduled", readClips: () => [{ id: "current", time: 60 + performance.now() / 1000, duration: 120, started: true, ended: false }], preventNext: jest.fn() });
	Reflect.set(globalThis, "window", { clipifyRunnerPresentation: player });
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("scheduled-source", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { executionGeneration: "scheduled", now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(59999);
		expect(engine.isRunning).toBe(true);
		expect(player.canAdvance()).toBe(false);
		expect(close).not.toHaveBeenCalled();
		player.notifyEnded("current");
		await jest.advanceTimersByTimeAsync(1);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.drainOutcome).toBe("clip_completed");
	} finally {
		await engine.stop();
		jest.useRealTimers();
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

test("TDD-US3-OPT038 U78: pre-end advancement remains permitted until drain captures the current clip", () => {
	let active = "first";
	const preventNext = jest.fn();
	const player = createPlaybackDrain({ generation: "scheduled", readClips: () => [{ id: active, time: 1, duration: 30, started: true, ended: false }], preventNext });
	player.notifyEnded("first");
	expect(player.canAdvance()).toBe(true);
	expect(preventNext).not.toHaveBeenCalled();
	active = "second";
	expect(player.requestDrain("scheduled").pendingClipIds).toEqual(["second"]);
	expect(preventNext).toHaveBeenCalledTimes(1);
	expect(player.canAdvance()).toBe(false);
});

test("TDD-US3-OPT039 U79: exact-end completion cannot advance while the native watchdog is between ticks", () => {
	let now = 999;
	let ended = false;
	const preventNext = jest.fn();
	const options = { generation: "scheduled", deadlineMonotonic: 1000, now: () => now, readClips: () => [{ id: "current", time: ended ? 30 : 29.999, duration: 30, started: true, ended }], preventNext };
	const player = createPlaybackDrain(options);
	expect(player.canAdvance()).toBe(true);
	now = 1000;
	ended = true;
	player.notifyEnded("current");
	expect(player.canAdvance()).toBe(false);
	expect(player.snapshot().state).toBe("drained");
	expect(preventNext).toHaveBeenCalledTimes(1);
});

test("TDD-US3-EC009: a delayed initial snapshot cannot restart or offset the sixty-second no-progress budget", async () => {
	jest.useFakeTimers();
	const report = { generation: "legacy", state: "draining", clips: [{ id: "current", time: 1, duration: 120, started: true, ended: false }], pendingClipIds: ["current"] };
	const close = jest.fn().mockResolvedValue(undefined);
	const evaluate = jest
		.fn()
		.mockResolvedValue(report)
		.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(report), 59999)));
	const engine = new Engine("delayed-initial-snapshot", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate };
	state.browser = { close };
	engine.isRunning = true;
	let completed = false;
	try {
		void engine.requestDrain().then(() => {
			completed = true;
		});
		await jest.advanceTimersByTimeAsync(59999);
		expect(close).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		expect(close).toHaveBeenCalledTimes(1);
		expect(completed).toBe(true);
		expect(engine.drainOutcome).toBe("playback_timeout");
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});

test("TDD-US3-OPT041 U81: standby drain closes immediately without consuming any watchdog time", async () => {
	jest.useFakeTimers();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const player = createPlaybackDrain({ generation: "standby", readClips: () => [{ id: "paused", time: 5, duration: 30, started: false, ended: false }], preventNext: jest.fn() });
	Reflect.set(globalThis, "window", { clipifyRunnerPresentation: player });
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("standby-source", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { executionGeneration: "standby", now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn(async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		await engine.requestDrain();
		expect(performance.now()).toBe(0);
		expect(close).toHaveBeenCalledTimes(1);
		expect(player.canAdvance()).toBe(false);
		expect(engine.drainOutcome).toBe("clip_completed");
	} finally {
		await engine.stop();
		jest.useRealTimers();
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

test("TDD-US3-EC009: Stop now interrupts finishing without reporting a playback timeout", async () => {
	jest.useFakeTimers();
	const close = jest.fn().mockResolvedValue(undefined);
	const report = { generation: "legacy", state: "draining", clips: [{ id: "current", time: 1, duration: 120, started: true, ended: false }], pendingClipIds: ["current"] };
	const engine = new Engine("explicit-emergency", "rtmp://fake", "secret", "", 30, "720p", "24_7", "http://api", "", { now: () => performance.now() });
	const state = engine as unknown as { page: unknown; browser: unknown };
	state.page = { evaluate: jest.fn().mockResolvedValue(report) };
	state.browser = { close };
	engine.isRunning = true;
	try {
		const draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(0);
		await engine.stop();
		await jest.advanceTimersByTimeAsync(250);
		await draining;
		expect(close).toHaveBeenCalledTimes(1);
		expect(engine.isRunning).toBe(false);
		expect(engine.drainOutcome).toBeNull();
	} finally {
		await engine.stop();
		jest.useRealTimers();
	}
});
