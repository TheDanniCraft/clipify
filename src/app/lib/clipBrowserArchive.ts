import type { ClipExportPlan } from "./clipExportPlan";
import type { ClipExportSummary } from "./clipExport";
import type { ClipExportProgress } from "./clipExportStream";
import { buildBrowserBatch } from "./clipBrowserBatch";
export type BrowserArchiveSink = {
	add: (name: string, bytes: Uint8Array<ArrayBuffer>) => Promise<string>;
	manifest: (items: Record<string, unknown>[]) => Promise<void>;
};
export function exportArchiveName(startedAt: string) {
	return `clipify-export-${startedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}.zip`;
}
async function lease(id: string) {
	let release!: () => void, acquired!: () => void;
	const ready = new Promise<void>((resolve) => {
		acquired = resolve;
	});
	const held = navigator.locks.request(`clipify-export:${id}`, async () => {
		acquired();
		await new Promise<void>((resolve) => {
			release = resolve;
		});
	});
	await Promise.race([ready, held]);
	return async () => {
		release();
		await held;
	};
}
async function cleanAbandoned(root: FileSystemDirectoryHandle) {
	const entries = root as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>;
	for await (const [id, handle] of entries) {
		if (handle.kind !== "directory" || !/^export-[a-f0-9-]{36}$/.test(id)) continue;
		await navigator.locks.request(`clipify-export:${id}`, { ifAvailable: true }, async (lock) => {
			if (lock) await root.removeEntry(id, { recursive: true });
		});
	}
}
export async function cleanupBrowserExports() {
	if (!navigator.storage?.getDirectory || !navigator.locks?.request) return;
	const root = await navigator.storage.getDirectory();
	let exports: FileSystemDirectoryHandle;
	try {
		exports = await root.getDirectoryHandle("clipify-exports");
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") return;
		throw error;
	}
	await cleanAbandoned(exports);
}
export async function createBrowserArchive(startedAt: string) {
	if (!navigator.storage?.getDirectory || !navigator.locks?.request) throw new Error("browser_storage_unavailable");
	await navigator.storage.persist?.().catch(() => false);
	const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("clipify-exports", { create: true });
	await cleanAbandoned(root);
	const id = `export-${crypto.randomUUID()}`,
		release = await lease(id);
	let output: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>> | undefined, metadata: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>> | undefined;
	const controller = new AbortController();
	const dispose = async () => {
		await root.removeEntry(id, { recursive: true }).catch(() => {});
		await release();
	};
	const abort = async () => {
		controller.abort();
		await Promise.allSettled([output?.abort(), metadata?.abort()]);
		await dispose();
	};
	try {
		const dir = await root.getDirectoryHandle(id, { create: true });
		const zipHandle = await dir.getFileHandle("export.zip", { create: true }),
			manifestHandle = await dir.getFileHandle("manifest.json", { create: true });
		output = (await zipHandle.createWritable()).getWriter();
		metadata = (await manifestHandle.createWritable()).getWriter();
		const disk = output,
			records = metadata,
			encode = new TextEncoder();
		const { ZipWriter, Uint8ArrayReader, BlobReader } = await import("@zip.js/zip.js");
		const zip = new ZipWriter(new WritableStream({ write: (chunk) => disk.write(chunk) }), { level: 0, bufferedWrite: false, zip64: true, useWebWorkers: false, preventClose: true, signal: controller.signal });
		let count = 0;
		const names = new Set<string>();
		await records.write(encode.encode(JSON.stringify({ version: 1, createdAt: startedAt }).slice(0, -1) + ',"clips":['));
		return {
			add: async (name: string, bytes: Uint8Array<ArrayBuffer>) => {
				let unique = name,
					index = 2;
				while (names.has(unique)) unique = name.replace(/(\.[^.]+)?$/, `-${index++}$1`);
				names.add(unique);
				try {
					await zip.add(unique, new Uint8ArrayReader(bytes));
				} catch (error) {
					throw new Error("browser_storage_error", { cause: error });
				}
				return unique;
			},
			manifest: async (items: Record<string, unknown>[]) => {
				if (!items.length) return;
				await records.write(encode.encode((count ? "," : "") + JSON.stringify(items).slice(1, -1)));
				count += items.length;
			},
			finish: async () => {
				await records.write(encode.encode("]}"));
				await records.close();
				await zip.add("manifest.json", new BlobReader(await manifestHandle.getFile()));
				await zip.close();
				await disk.close();
				await dir.removeEntry("manifest.json");
				return { file: await zipHandle.getFile(), dispose };
			},
			abort,
		};
	} catch (error) {
		await abort();
		throw error;
	}
}
function waitForQuota(until: string | undefined, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		signal.throwIfAborted();
		const done = () => {
			signal.removeEventListener("abort", abort);
			resolve();
		};
		const timer = setTimeout(done, Number.isFinite(Date.parse(until ?? "")) ? Math.max(1000, Date.parse(until!) - Date.now()) : 60000);
		const abort = () => {
			clearTimeout(timer);
			reject(signal.reason ?? new Error("CANCELLED"));
		};
		signal.addEventListener("abort", abort, { once: true });
	});
}
export async function buildBrowserArchive(plans: ClipExportPlan[], startedAt: string, signal: AbortSignal, progress: (event: ClipExportProgress) => void, waiting: (retryAt?: string) => void) {
	const archive = await createBrowserArchive(startedAt);
	const cancel = () => {
		void archive.abort();
	};
	signal.addEventListener("abort", cancel, { once: true });
	const summary: ClipExportSummary = { included: [], skipped: [] };
	let offset = 0;
	try {
		for (const plan of plans) {
			signal.throwIfAborted();
			waiting();
			let result = await buildBrowserBatch(plan, signal, (event) => progress({ ...event, index: event.index + offset }), undefined, "zip", archive);
			while (!result.ok && result.code === "RATE_LIMITED") {
				waiting(result.retryAt ?? new Date(Date.now() + 60000).toISOString());
				await waitForQuota(result.retryAt, signal);
				waiting();
				result = await buildBrowserBatch(plan, signal, (event) => progress({ ...event, index: event.index + offset }), undefined, "zip", archive);
			}
			if (!result.ok) {
				if (!result.failures?.length) {
					await archive.abort();
					return result;
				}
				summary.skipped.push(...result.failures.map((item) => ({ ...item, index: item.index + offset })));
			} else {
				summary.included.push(...result.summary.included.map((index) => index + offset));
				summary.skipped.push(...result.summary.skipped.map((item) => ({ ...item, index: item.index + offset })));
				if (result.summary.retryAt) summary.retryAt = result.summary.retryAt;
			}
			offset += plan.files.length;
		}
		if (!summary.included.length) {
			await archive.abort();
			return { ok: false as const, code: "EXPORT_UNAVAILABLE", failures: summary.skipped };
		}
		const result = await archive.finish();
		signal.throwIfAborted();
		return { ok: true as const, bytes: result.file, summary, dispose: result.dispose };
	} catch (error) {
		await archive.abort();
		throw error;
	} finally {
		signal.removeEventListener("abort", cancel);
	}
}
