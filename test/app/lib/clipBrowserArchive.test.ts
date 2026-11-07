/** @jest-environment node */
import { buildBrowserArchive, cleanupBrowserExports, createBrowserArchive, exportArchiveName } from "@lib/clipBrowserArchive";
import { unzipSync, strFromU8 } from "fflate";
const packet = jest.fn();
jest.mock("@lib/clipBrowserBatch", () => ({ buildBrowserBatch: (...args: unknown[]) => packet(...args) }));
import { createClipExportPlan } from "@lib/clipExportPlan";
const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
function directory(name = "root") {
	const items = new Map<string, any>();
	const dir: any = {
		kind: "directory",
		name,
		items,
		async getDirectoryHandle(key: string) {
			if (!items.has(key)) items.set(key, directory(key));
			return items.get(key);
		},
		async getFileHandle(key: string) {
			if (!items.has(key)) {
				const chunks: Uint8Array<ArrayBuffer>[] = [];
				items.set(key, {
					kind: "file",
					name: key,
					createWritable: async () =>
						new WritableStream({
							write: (chunk) => {
								chunks.push(new Uint8Array(chunk));
							},
						}),
					getFile: async () => new File(chunks, key),
				});
			}
			return items.get(key);
		},
		async removeEntry(key: string) {
			items.delete(key);
		},
		async *[Symbol.asyncIterator]() {
			yield* items.entries();
		},
	};
	return dir;
}
function storage() {
	const root = directory(),
		held = new Set<string>();
	const persist = jest.fn(async () => false);
	const locks = {
		request: jest.fn(async (name: string, options: any, callback?: any) => {
			const fn = callback ?? options;
			if (held.has(name)) return fn(null);
			held.add(name);
			try {
				return await fn({ name });
			} finally {
				held.delete(name);
			}
		}),
	};
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: { storage: { getDirectory: async () => root, persist }, locks } });
	return { root, held, persist };
}
afterEach(() => {
	if (original) Object.defineProperty(globalThis, "navigator", original);
	else delete (globalThis as any).navigator;
});
it("writes one ZIP64 archive and complete metadata incrementally, then disposes its private files", async () => {
	const { root, persist, held } = storage();
	const archive = await createBrowserArchive("2026-11-07T12:30:00.000Z");
	const bytes = new TextEncoder().encode("video");
	expect(await archive.add("clip.mp4", bytes)).toBe("clip.mp4");
	expect(await archive.add("clip.mp4", bytes)).toBe("clip-2.mp4");
	await archive.manifest([{ id: "A", filename: "clip.mp4" }]);
	await archive.manifest([]);
	await archive.manifest([{ id: "B", filename: "clip-2.mp4" }]);
	const { file, dispose } = await archive.finish();
	const data = new Uint8Array(await file.arrayBuffer());
	const zip = unzipSync(data);
	expect(Object.keys(zip)).toEqual(["clip.mp4", "clip-2.mp4", "manifest.json"]);
	expect(JSON.parse(strFromU8(zip["manifest.json"])).clips).toHaveLength(2);
	expect(Buffer.from(data).includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]))).toBe(true);
	expect(persist).toHaveBeenCalled();
	expect(held.size).toBe(1);
	await dispose();
	expect(held.size).toBe(0);
	expect(root.items.get("clipify-exports").items.size).toBe(0);
	expect(exportArchiveName("2026-11-07T12:30:00.000Z")).toBe("clipify-export-2026-11-07T12-30-00Z.zip");
});
it("cleans abandoned exports while preserving other tabs and unrelated storage", async () => {
	const { root } = storage(),
		parent = await root.getDirectoryHandle("clipify-exports");
	await parent.getDirectoryHandle("export-00000000-0000-0000-0000-000000000000");
	await parent.getDirectoryHandle("other-data");
	const first = await createBrowserArchive(new Date().toISOString());
	const second = await createBrowserArchive(new Date().toISOString());
	expect(parent.items.size).toBe(3);
	expect(parent.items.has("other-data")).toBe(true);
	await first.abort();
	await second.abort();
	expect(parent.items.size).toBe(1);
});
it("does not require a persistence grant but reports unsupported storage", async () => {
	storage();
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
	await expect(createBrowserArchive(new Date().toISOString())).rejects.toThrow("browser_storage_unavailable");
});
it("removes partial files when construction or entry writing fails", async () => {
	const { root } = storage();
	const parent = await root.getDirectoryHandle("clipify-exports");
	const get = parent.getDirectoryHandle;
	parent.getDirectoryHandle = async (name: string) => {
		const d = await get(name);
		d.getFileHandle = async () => {
			throw new DOMException("full", "QuotaExceededError");
		};
		return d;
	};
	await expect(createBrowserArchive(new Date().toISOString())).rejects.toThrow("full");
	expect(parent.items.size).toBe(0);
});

it("combines multiple processing packets into one archive with global progress and metadata", async () => {
	const { root } = storage();
	const plans = createClipExportPlan(
		"owner",
		Array.from({ length: 51 }, (_, i) => `Clip${i}`),
		[{ key: "original", label: "Original" }],
	);
	packet.mockImplementation(async (plan, signal, progress, onPart, format, sink) => {
		const included = [];
		for (const [index, item] of plan.files.entries()) {
			const filename = await sink.add(`${item.clipId}.mp4`, new Uint8Array([index]));
			await sink.manifest([{ id: item.clipId, filename }]);
			progress({ index, stage: "ready" });
			included.push(index);
		}
		return { ok: true, bytes: new Uint8Array(0), summary: { included, skipped: [] } };
	});
	const progress = jest.fn(),
		waiting = jest.fn();
	const result = await buildBrowserArchive(plans, new Date().toISOString(), new AbortController().signal, progress, waiting);
	expect(result.ok).toBe(true);
	if (!result.ok) throw Error("failed");
	expect(result.summary.included).toHaveLength(51);
	expect(progress).toHaveBeenLastCalledWith({ index: 50, stage: "ready" });
	const zip = unzipSync(new Uint8Array(await result.bytes.arrayBuffer()));
	expect(Object.keys(zip)).toHaveLength(52);
	expect(JSON.parse(strFromU8(zip["manifest.json"])).clips).toHaveLength(51);
	await result.dispose();
	expect(root.items.get("clipify-exports").items.size).toBe(0);
});
it("waits for the quota reset while retaining prepared files in the same archive", async () => {
	storage();
	jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] });
	try {
		const plans = createClipExportPlan("owner", ["A"], [{ key: "original", label: "Original" }]),
			waiting = jest.fn();
		packet.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED", retryAt: new Date(Date.now() + 1000).toISOString() }).mockResolvedValueOnce({ ok: true, summary: { included: [0], skipped: [], retryAt: new Date().toISOString() } });
		const work = buildBrowserArchive(plans, new Date().toISOString(), new AbortController().signal, () => {}, waiting);
		for (let i = 0; i < 1000 && !waiting.mock.calls.some((call) => call[0]); i++) await Promise.resolve();
		expect(waiting.mock.calls.some((call) => call[0])).toBe(true);
		await jest.advanceTimersByTimeAsync(1500);
		const result = await work;
		expect(result.ok).toBe(true);
		if (result.ok) await result.dispose();
	} finally {
		jest.useRealTimers();
	}
});
it("aborts buffered media on a fatal permission error", async () => {
	const { root } = storage();
	packet.mockResolvedValueOnce({ ok: false, code: "PERMISSION_DENIED" });
	const result = await buildBrowserArchive(
		createClipExportPlan("owner", ["A"], [{ key: "original", label: "Original" }]),
		new Date().toISOString(),
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(result).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	expect(root.items.get("clipify-exports").items.size).toBe(0);
});
it("retains skipped indices across packets and discards an export with no valid files", async () => {
	const { root } = storage();
	packet.mockResolvedValue({ ok: false, code: "EXPORT_UNAVAILABLE", failures: [{ index: 0, code: "clip_unavailable", retryable: false }] });
	const result = await buildBrowserArchive(
		createClipExportPlan("owner", ["A"], [{ key: "original", label: "Original" }]),
		new Date().toISOString(),
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(result).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE", failures: [{ index: 0 }] });
	expect(root.items.get("clipify-exports").items.size).toBe(0);
});
it("cleans the archive when cancelled while waiting for quota without a retry timestamp", async () => {
	const { root } = storage(),
		controller = new AbortController();
	packet.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED" });
	await expect(
		buildBrowserArchive(
			createClipExportPlan("owner", ["A"], [{ key: "original", label: "Original" }]),
			new Date().toISOString(),
			controller.signal,
			() => {},
			(retry) => {
				if (retry) setImmediate(() => controller.abort());
			},
		),
	).rejects.toBeDefined();
	expect(root.items.get("clipify-exports").items.size).toBe(0);
});
it("cleans the archive after an unexpected processing error", async () => {
	const { root } = storage();
	packet.mockRejectedValueOnce(Error("broken"));
	await expect(
		buildBrowserArchive(
			createClipExportPlan("owner", ["A"], [{ key: "original", label: "Original" }]),
			new Date().toISOString(),
			new AbortController().signal,
			() => {},
			() => {},
		),
	).rejects.toThrow("broken");
	expect(root.items.get("clipify-exports").items.size).toBe(0);
});

it("continues with available disk storage when persistence permission is refused", async () => {
	const { persist } = storage();
	persist.mockRejectedValueOnce(Error("denied"));
	const archive = await createBrowserArchive(new Date().toISOString());
	await archive.abort();
});

it("propagates retry progress and preserves skipped metadata in a partial archive", async () => {
	storage();
	packet.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED", retryAt: new Date(Date.now() - 1000).toISOString() }).mockImplementationOnce(async (plan, signal, progress, parts, format, sink) => {
		progress({ index: 0, stage: "ready" });
		await sink.manifest([{ id: "A", status: "skipped" }]);
		return { ok: true, summary: { included: [1], skipped: [{ index: 0, code: "clip_unavailable", retryable: false }] } };
	});
	const progress = jest.fn();
	const result = await buildBrowserArchive(createClipExportPlan("owner", ["A", "B"], [{ key: "original", label: "Original" }]), new Date().toISOString(), new AbortController().signal, progress, () => {});
	expect(result.ok).toBe(true);
	expect(progress).toHaveBeenCalledWith({ index: 0, stage: "ready" });
	if (result.ok) {
		expect(result.summary.skipped[0].index).toBe(0);
		await result.dispose();
	}
});
it("releases its lease even if removal of a private cache file fails", async () => {
	const { root, held } = storage(),
		archive = await createBrowserArchive(new Date().toISOString());
	root.items.get("clipify-exports").removeEntry = jest.fn(async () => {
		throw Error("readonly");
	});
	await archive.abort();
	expect(held.size).toBe(0);
});
it("cleans abandoned exports on startup and treats an absent folder as empty", async () => {
	const { root } = storage();
	await cleanupBrowserExports();
	root.getDirectoryHandle = jest.fn(async () => {
		throw new DOMException("absent", "NotFoundError");
	});
	await expect(cleanupBrowserExports()).resolves.toBeUndefined();
	root.getDirectoryHandle = jest.fn(async () => {
		throw Error("denied");
	});
	await expect(cleanupBrowserExports()).rejects.toThrow("denied");
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
	await cleanupBrowserExports();
});
it("aborts a partially written archive after a disk write error", async () => {
	const { root } = storage(),
		parent = await root.getDirectoryHandle("clipify-exports"),
		get = parent.getDirectoryHandle;
	parent.getDirectoryHandle = async (name: string) => {
		const dir = await get(name),
			getFile = dir.getFileHandle;
		dir.getFileHandle = async (key: string) => {
			const file = await getFile(key);
			if (key === "export.zip")
				file.createWritable = async () =>
					new WritableStream({
						write() {
							throw new DOMException("full", "QuotaExceededError");
						},
					});
			return file;
		};
		return dir;
	};
	const archive = await createBrowserArchive(new Date().toISOString());
	await expect(archive.add("clip.mp4", new Uint8Array([1]))).rejects.toThrow("browser_storage_error");
	await archive.abort();
	expect(parent.items.size).toBe(0);
});
