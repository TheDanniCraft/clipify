/** @jest-environment node */
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { creatorBrandSchema } from "@lib/overlayMetadata";
it("renders actual selected-font pixels and rejects an untrusted font redirect", async () => {
	const api = await import("@/server/brand-font-render").catch(() => null);
	expect(api).not.toBeNull();
	if (!api) return;
	const font = await readFile(join(process.cwd(), "test/fixtures/fonts/Laila-Regular.ttf"));
	const fetcher = jest.spyOn(global, "fetch").mockImplementation(async (url) => (String(url).startsWith("https://fonts.googleapis.com/") ? new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/test.ttf)} @font-face {font-weight:700;src:url(https://fonts.gstatic.com/s/laila/test.ttf)}") : new Response(font)));
	const dir = await mkdtemp(join(tmpdir(), "clipify-brand-font-test-"));
	try {
		const clip = { title: "Clipify brand typography", clipCreatorName: "Viewer" };
		const normal = await api.renderBrandWidget("title", clip, 720, 140, 32, creatorBrandSchema.parse({}), AbortSignal.timeout(10000));
		const styled = await api.renderBrandWidget("title", clip, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(10000));
		expect(normal.equals(styled)).toBe(false);
		expect(await sharp(styled).metadata()).toMatchObject({ width: 720, height: 140 });
		await rm(dir, { recursive: true, force: true });
		const secondDir = await mkdtemp(join(tmpdir(), "clipify-brand-font-next-"));
		try {
			const repeated = await api.renderBrandWidget("title", clip, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(10000));
			expect(repeated.equals(styled)).toBe(true);
		} finally {
			await rm(secondDir, { recursive: true, force: true });
		}

		expect(fetcher.mock.calls.every(([url]) => /https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(String(url)))).toBe(true);
		fetcher.mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/font.ttf" } }));
		await expect(api.renderBrandWidget("title", clip, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Another Font" }), AbortSignal.timeout(10000))).rejects.toThrow("font_unavailable");
	} finally {
		fetcher.mockRestore();
		await rm(dir, { recursive: true, force: true });
	}
});
it("rejects unavailable font styles, oversized files and malformed binaries instead of exporting fallback glyphs", async () => {
	const { renderBrandWidget, validateBrandFont } = await import("@/server/brand-font-render");
	const dir = await mkdtemp(join(tmpdir(), "clipify-bad-font-"));
	const font = await readFile(join(process.cwd(), "test/fixtures/fonts/Laila-Regular.ttf"));
	const spy = jest.spyOn(global, "fetch");
	try {
		const bad = [new Response(null, { status: 404 }), new Response("not CSS"), new Response("@font-face {font-weight:400;src:url(http://127.0.0.1/font.ttf)}")];
		for (let i = 0; i < bad.length; i++) {
			spy.mockResolvedValue(bad[i]);
			await expect(renderBrandWidget("title", { title: "x" }, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: `Bad Style ${i}` }), AbortSignal.timeout(1000))).rejects.toThrow("font_unavailable");
		}
		for (const response of [() => new Response(null, { status: 302 }), () => new Response(font, { headers: { "content-length": "3000000" } }), () => new Response("not a font")]) {
			const name = `Bad File ${Date.now()}`;
			spy.mockImplementation(async (url) => (String(url).includes("googleapis") ? new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/file.ttf)}") : response()));
			await expect(renderBrandWidget("title", { title: "x" }, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: name }), AbortSignal.timeout(1000))).rejects.toThrow("font_unavailable");
		}
		spy.mockClear();
		await validateBrandFont(creatorBrandSchema.parse({}), AbortSignal.timeout(1000));
		expect(spy).not.toHaveBeenCalled();
		spy.mockImplementation(async (url) => (String(url).includes("googleapis") ? new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/file.ttf)}") : new Response(font)));
		await validateBrandFont(creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(1000));
		await renderBrandWidget("title", { title: '<hostile> & "literal"' }, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(1000));
	} finally {
		jest.useRealTimers();
		spy.mockRestore();
		await rm(dir, { recursive: true, force: true });
	}
});
it("bounds concurrent font loads, evicts idle assets and restores a font at the same stable path", async () => {
	const api = await import("@/server/brand-font-render");
	const font = await readFile(join(process.cwd(), "test/fixtures/fonts/Laila-Regular.ttf"));
	const comparison = { title: "Consistent across jobs" };
	const waiting: Array<() => void> = [];
	const spy = jest.spyOn(global, "fetch").mockImplementation(async (url) => (String(url).includes("googleapis") ? new Promise<Response>((resolve) => waiting.push(() => resolve(new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/cache.ttf)}")))) : new Response(font)));
	try {
		const blockedFetch = spy.getMockImplementation()!;
		spy.mockImplementation(async (url) => (String(url).includes("googleapis") ? new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/cache.ttf)}") : new Response(font)));
		const baseline = await api.renderBrandWidget("title", comparison, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(10000));
		spy.mockImplementation(blockedFetch);
		const requests = Array.from({ length: 8 }, (_, i) => api.validateBrandFont(creatorBrandSchema.parse({ fontSource: "google", fontFamily: `Cache Font ${i}` }), AbortSignal.timeout(10000)));
		for (let i = 0; i < 100 && waiting.length < 8; i++) await new Promise((resolve) => setTimeout(resolve, 5));
		expect(waiting).toHaveLength(8);
		await expect(api.validateBrandFont(creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Cache Font Extra" }), AbortSignal.timeout(1000))).rejects.toThrow("font_unavailable");
		waiting.forEach((resolve) => resolve());
		await Promise.all(requests);
		spy.mockImplementation(async (url) => (String(url).includes("googleapis") ? new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/cache.ttf)}") : new Response(font)));
		const first = await api.renderBrandWidget("title", { title: "Consistent across jobs" }, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(10000));
		const second = await api.renderBrandWidget("title", { title: "Consistent across jobs" }, 720, 140, 32, creatorBrandSchema.parse({ fontSource: "google", fontFamily: "Laila" }), AbortSignal.timeout(10000));
		expect(first.equals(second)).toBe(true);
		expect(first.equals(baseline)).toBe(true);
	} finally {
		spy.mockRestore();
	}
});
