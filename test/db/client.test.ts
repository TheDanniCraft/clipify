/** @jest-environment node */
import { EventEmitter } from "node:events";
const mockCaptureUnexpectedError = jest.fn();
import type { Pool } from "pg";
jest.mock("@/app/lib/sentryServer", () => ({ captureUnexpectedError: (...args: unknown[]) => mockCaptureUnexpectedError(...args) }));

test("reports failed idle and leased clients without throwing and registers once across module reloads", async () => {
	const previous = globalThis.__dbPool;
	delete globalThis.__dbPool;
	let pool!: Pool;
	try {
		await jest.isolateModulesAsync(async () => {
			pool = (await import("@/db/client")).dbPool;
		});
		const failure = new Error("Connection terminated unexpectedly");
		expect(() => pool.emit("error", failure)).not.toThrow();
		expect(mockCaptureUnexpectedError).toHaveBeenCalledWith(failure, "database", "connection");
		await jest.isolateModulesAsync(async () => {
			expect((await import("@/db/client")).dbPool).toBe(pool);
		});
		expect(pool.listenerCount("error")).toBe(1);
		jest.mocked(mockCaptureUnexpectedError).mockClear();
		pool.emit("error", failure);
		expect(mockCaptureUnexpectedError).toHaveBeenCalledTimes(1);
		const client = new EventEmitter();
		for (let lease = 0; lease < 2; lease++) {
			pool.emit("acquire", client);
			expect(client.listenerCount("error")).toBe(1);
			expect(() => client.emit("error", failure)).not.toThrow();
			pool.emit("release", undefined, client);
			expect(client.listenerCount("error")).toBe(0);
		}
		expect(mockCaptureUnexpectedError).toHaveBeenCalledTimes(3);
	} finally {
		await pool?.end();
		globalThis.__dbPool = previous;
	}
});
