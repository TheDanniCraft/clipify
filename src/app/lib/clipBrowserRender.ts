import type { BrowserOutput } from "./clipBrowserExport";
export type BrowserCapability = "supported" | "slow" | "unsupported";
async function worker() {
	return (await import("./clipExportWorkerFactory")).createClipExportWorker();
}
let capability: Promise<BrowserCapability> | undefined;
export function browserExportCapability(refresh = false): Promise<BrowserCapability> {
	if (refresh) capability = undefined;
	return (capability ??= (async () => {
		if (typeof Worker === "undefined") return "unsupported" as const;
		let instance: Worker;
		try {
			instance = await worker();
		} catch {
			return "unsupported" as const;
		}
		return new Promise<BrowserCapability>((resolve) => {
			const finish = (result: BrowserCapability) => {
				clearTimeout(timer);
				instance.terminate();
				resolve(result);
			};
			const timer = setTimeout(() => finish("unsupported"), 10000);
			instance.onmessage = (e) => finish(["supported", "slow"].includes(e.data.value) ? e.data.value : "unsupported");
			instance.onerror = () => finish("unsupported");
			instance.postMessage({ type: "probe" });
		});
	})());
}
export async function renderBrowserClip(bytes: Uint8Array, output: BrowserOutput, signal: AbortSignal, progress: (value: number) => void): Promise<Uint8Array<ArrayBuffer>> {
	signal.throwIfAborted();
	const instance = await worker();
	if (signal.aborted) {
		instance.terminate();
		signal.throwIfAborted();
	}
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", cancel);
			instance.terminate();
		};
		const cancel = () => {
			cleanup();
			reject(signal.reason ?? new Error("CANCELLED"));
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error("browser_unsupported"));
		}, 300000);
		signal.addEventListener("abort", cancel, { once: true });
		instance.onerror = () => {
			cleanup();
			reject(new Error("browser_unsupported"));
		};
		instance.onmessage = (e) => {
			if (e.data.type === "progress") {
				progress(e.data.value);
				return;
			}
			cleanup();
			if (e.data.type === "result") resolve(new Uint8Array(e.data.bytes));
			else reject(new Error(e.data.code ?? "browser_unsupported"));
		};
		const buffer = bytes.slice().buffer;
		instance.postMessage({ type: "render", bytes: buffer, output }, [buffer]);
	});
}
