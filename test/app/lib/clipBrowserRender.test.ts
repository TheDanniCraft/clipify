import { browserExportCapability, renderBrowserClip } from "@lib/clipBrowserRender";
const create = jest.fn();
jest.mock("@lib/clipExportWorkerFactory", () => ({ createClipExportWorker: () => create() }));
const originalWorker = global.Worker;
afterEach(() => {
	global.Worker = originalWorker;
	jest.useRealTimers();
});
it("does not promise export support when Worker is unavailable", async () => {
	Object.defineProperty(global, "Worker", { configurable: true, writable: true, value: undefined });
	await expect(browserExportCapability(true)).resolves.toBe("unsupported");
});
it("caches a successful real-probe result and terminates the probe worker", async () => {
	global.Worker = jest.fn() as never;
	const instance: any = { terminate: jest.fn(), postMessage: () => queueMicrotask(() => instance.onmessage({ data: { type: "capability", value: "supported" } })) };
	create.mockReturnValue(instance);
	await expect(browserExportCapability(true)).resolves.toBe("supported");
	await expect(browserExportCapability()).resolves.toBe("supported");
	expect(instance.terminate).toHaveBeenCalledTimes(1);
});
it("terminates an active encoder when the export is cancelled", async () => {
	const instance: any = { terminate: jest.fn(), postMessage: jest.fn() };
	create.mockReturnValue(instance);
	const controller = new AbortController();
	const pending = renderBrowserClip(new Uint8Array([1]), {} as never, controller.signal, () => {});
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	controller.abort(new Error("CANCELLED"));
	await expect(pending).rejects.toThrow("CANCELLED");
	expect(instance.terminate).toHaveBeenCalledTimes(1);
});
