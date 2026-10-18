import { Engine } from "../engine";
jest.mock("puppeteer-stream", () => ({ launch: jest.fn(), getStream: jest.fn() }));
jest.mock("../downloader", () => ({ ensureDependencies: jest.fn() }));
let mockExecutionNow = 0;
jest.mock("../execution-clock", () => ({ executionNow: () => mockExecutionNow }));

test("TDD-US1-CON004 Engine drain honors the shared elapsed deadline after PC resume", async () => {
	jest.useFakeTimers();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const snapshot = () => ({ generation: "legacy", state: "draining", clips: [{ id: "current", time: 1, duration: 900, started: true, ended: false }] });
	Reflect.set(globalThis, "window", { clipifyRunnerPresentation: { requestDrain: snapshot, snapshot } });
	const close = jest.fn().mockResolvedValue(undefined);
	const engine = new Engine("source", "rtmp://127.0.0.1/live", "secret", "");
	Object.assign(engine, { isRunning: true, page: { evaluate: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }, browser: { close } });
	let draining: Promise<void> | undefined;
	try {
		draining = engine.requestDrain();
		await jest.advanceTimersByTimeAsync(0);
		expect(close).not.toHaveBeenCalled();
		mockExecutionNow = 300000;
		await jest.advanceTimersByTimeAsync(250);
		expect(close).toHaveBeenCalledTimes(1);
		await draining;
	} finally {
		await engine.stop();
		await jest.advanceTimersByTimeAsync(250);
		await draining;
		jest.useRealTimers();
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});
