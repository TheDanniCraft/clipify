/** @jest-environment node */
import { buildBrowserBatch } from "@lib/clipBrowserBatch";
import { createClipComposition } from "@lib/clipComposition";
import { createClipExportPlan } from "@lib/clipExportPlan";
const renderVideo = jest.fn();
const archive = jest.fn();
jest.mock("@lib/clipBrowserRender", () => ({ renderBrowserClip: (...args: unknown[]) => renderVideo(...args) }));
jest.mock("fflate", () => ({ ...jest.requireActual("fflate"), zipSync: (...args: unknown[]) => archive(...args) }));
afterEach(() => jest.restoreAllMocks());
it("downloads bounded ZIP parts instead of skipping otherwise valid files when a package fills", async () => {
	const layout = createClipComposition("desktop");
	const outputs = Array.from({ length: 5 }, (_, i) => ({ key: `version${i}`, label: `Version ${i}`, layout }));
	const plan = createClipExportPlan("creator", ["ClipA"], outputs)[0];
	const recipe = { ok: true, clips: [{ id: "ClipA", title: "Synthetic", sourceToken: "ticket", outputs: outputs.map((o) => ({ ...o, assets: {}, watermark: null })) }] };
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(new Response(JSON.stringify(recipe)))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	// Reuse the buffer to exercise real byte accounting without allocating five video files.
	renderVideo.mockResolvedValue(new Uint8Array(31 * 1024 * 1024));
	archive.mockImplementation((files: Record<string, Uint8Array>) => new Uint8Array([Object.keys(files).filter((key) => key.endsWith(".mp4")).length]));
	const part = jest.fn();
	const result = await buildBrowserBatch(plan, new AbortController().signal, () => {}, part);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.summary.included).toHaveLength(5);
		expect(result.summary.skipped).toHaveLength(0);
		expect(result.partCount).toBe(2);
		expect(result.bytes).toEqual(new Uint8Array([1]));
	}
	expect(part).toHaveBeenCalledWith(new Uint8Array([4]), 1);
});
it("retains already downloaded parts and retries only later rate-limited files", async () => {
	const layout = createClipComposition("desktop");
	const outputs = Array.from({ length: 5 }, (_, i) => ({ key: `version${i}`, label: `Version ${i}`, layout }));
	const plan = createClipExportPlan("creator", ["ClipA", "ClipB"], outputs)[0];
	const recipe = { ok: true, clips: ["ClipA", "ClipB"].map((id) => ({ id, title: id, sourceToken: id, outputs: outputs.map((o) => ({ ...o, assets: {}, watermark: null })) })) };
	const retryAt = new Date(Date.now() + 60000).toISOString();
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(new Response(JSON.stringify(recipe)))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
		.mockResolvedValueOnce(Response.json({ code: "RATE_LIMITED", retryAt }, { status: 429 }));
	renderVideo.mockResolvedValue(new Uint8Array(31 * 1024 * 1024));
	archive.mockImplementation((files: Record<string, Uint8Array>) => new Uint8Array([Object.keys(files).filter((key) => key.endsWith(".mp4")).length]));
	const part = jest.fn();
	const result = await buildBrowserBatch(plan, new AbortController().signal, () => {}, part);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.summary.included).toEqual([0, 1, 2, 3, 4]);
		expect(result.summary.skipped.map((f) => f.index)).toEqual([5, 6, 7, 8, 9]);
		expect(result.summary.retryAt).toBe(retryAt);
	}
	expect(part).toHaveBeenCalledTimes(1);
});
it.each(["recipe", "media"])("retains available files and does not retry known unavailable clips (%s)", async (mode) => {
	const plan = createClipExportPlan("creator", ["ClipA", "ClipB"], [{ key: "original", label: "Original" }])[0];
	const outputs = [{ key: "original", label: "Original", layout: null, assets: {}, watermark: null }];
	const recipe = {
		ok: true,
		clips: [
			{ id: "ClipA", title: "Available", sourceToken: "a", outputs },
			{ id: "ClipB", title: "Removed", sourceToken: "b", outputs, ...(mode === "recipe" ? { error: "clip_unavailable" } : {}) },
		],
	};
	const fetch = jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json(recipe))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	if (mode === "media") fetch.mockResolvedValueOnce(Response.json({ code: "EXPORT_UNAVAILABLE", failures: [{ index: 0, code: "clip_unavailable", retryable: false }] }, { status: 409 }));
	archive.mockReturnValue(new Uint8Array([1]));
	const result = await buildBrowserBatch(
		plan,
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.summary.included).toEqual([0]);
		expect(result.summary.skipped).toEqual([expect.objectContaining({ index: 1, code: "clip_unavailable", retryable: false })]);
	}
	expect(fetch).toHaveBeenCalledTimes(mode === "recipe" ? 2 : 3);
});
it("retains public export metadata and byte counts without including source capabilities", async () => {
	const plan = createClipExportPlan("creator", ["ClipA"], [{ key: "original", label: "Original" }])[0];
	const recipe = { ok: true, clips: [{ id: "ClipA", title: "Synthetic", views: 42, duration: 1, categoryId: "123", broadcasterName: "Channel", createdAt: "2026-11-01T00:00:00Z", sourceToken: "secret-source-capability", outputs: [{ key: "original", label: "Original", layout: null, assets: {}, watermark: null }] }] };
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json(recipe))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	let manifest = "";
	archive.mockImplementation((files: Record<string, Uint8Array>) => {
		manifest = new TextDecoder().decode(files["manifest.json"]);
		return new Uint8Array([1]);
	});
	await buildBrowserBatch(
		plan,
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(JSON.parse(manifest).clips[0]).toMatchObject({ views: 42, duration: 1, categoryId: "123", broadcasterName: "Channel", status: "included", bytes: 3, format: "original" });
	expect(JSON.parse(manifest).clips[0].filename).toContain("Original");
	expect(manifest).not.toContain("secret-source-capability");
	expect(JSON.parse(manifest).clips[0]).not.toHaveProperty("outputs");
});
it("reports an unavailable browser encoder as recoverable through explicit server processing", async () => {
	const layout = createClipComposition("mobile");
	const plan = createClipExportPlan("creator", ["ClipA"], [{ key: "mobile", label: "Mobile", layout }])[0];
	const recipe = { ok: true, clips: [{ id: "ClipA", title: "Synthetic", sourceToken: "ticket", outputs: [{ key: "mobile", label: "Mobile", layout, assets: {}, watermark: null }] }] };
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json(recipe))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	renderVideo.mockRejectedValueOnce(new Error("browser_unsupported"));
	const result = await buildBrowserBatch(
		plan,
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(result).toMatchObject({ ok: false, code: "BROWSER_UNSUPPORTED", failures: [{ index: 0, code: "browser_unsupported", retryable: true }] });
});
it("encodes Original framing when an output preset is selected", async () => {
	const plan = createClipExportPlan("creator", ["A"], [{ key: "original", label: "Original" }], { id: "custom", maxSizeMB: 10 })[0];
	const output = { key: "original", label: "Original", layout: null, assets: {}, watermark: null, preset: { id: "custom", maxSizeMB: 10 } };
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json({ ok: true, clips: [{ id: "A", title: "Original", sourceToken: "ticket", outputs: [output] }] }))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	renderVideo.mockResolvedValue(new Uint8Array([4, 5, 6]));
	archive.mockReturnValue(new Uint8Array([1]));
	await buildBrowserBatch(
		plan,
		new AbortController().signal,
		() => {},
		() => {},
	);
	expect(renderVideo).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), output, expect.any(AbortSignal), expect.any(Function));
});
it("downloads a single MP4 directly without ZIP wrapping", async () => {
	const plan = createClipExportPlan("creator", ["A"], [{ key: "original", label: "Original" }])[0];
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json({ ok: true, clips: [{ id: "A", title: "Original", sourceToken: "ticket", outputs: [{ key: "original", label: "Original", layout: null, assets: {}, watermark: null }] }] }))
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
	const part = jest.fn();
	const result = await buildBrowserBatch(plan, new AbortController().signal, () => {}, part, "mp4");
	expect(result).toMatchObject({ ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } });
	expect(part).not.toHaveBeenCalled();
});
it("writes each rendered file to an archive sink without making in-memory ZIP parts", async () => {
	const outputs = Array.from({ length: 5 }, (_, i) => ({ key: `version${i}`, label: `Version ${i}`, layout: createClipComposition("desktop") }));
	const plan = createClipExportPlan("creator", ["ClipA"], outputs)[0];
	jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json({ ok: true, clips: [{ id: "ClipA", title: "Clip", sourceToken: "ticket", outputs: outputs.map((output) => ({ ...output, assets: {}, watermark: null })) }] }))
		.mockResolvedValueOnce(new Response(new Uint8Array([1])));
	renderVideo.mockResolvedValue(new Uint8Array(31 * 1024 * 1024));
	const sink = {
			add: jest.fn(async (name: string) => name),
			manifest: jest.fn(async (items: Record<string, unknown>[]) => {
				void items;
			}),
		},
		part = jest.fn();
	archive.mockClear();
	const result = await buildBrowserBatch(plan, new AbortController().signal, () => {}, part, "zip", sink);
	expect(result.ok).toBe(true);
	expect(sink.add).toHaveBeenCalledTimes(5);
	expect(sink.manifest.mock.calls[0][0]).toHaveLength(5);
	expect(archive).not.toHaveBeenCalled();
	expect(part).not.toHaveBeenCalled();
});
