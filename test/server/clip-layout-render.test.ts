/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderClipLayout } from "@/server/clip-layout-render";
import { defaultClipLayout } from "@lib/clipLayout";
it("renders playable full and stacked portrait MP4s with audio and literal hostile-looking metadata", async () => {
	const dir = await mkdtemp(join(tmpdir(), "clipify-render-test-"));
	try {
		const input = join(dir, "source.mp4");
		execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "0.3", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", input]);
		const bytes = new Uint8Array(await readFile(input));
		for (const mode of ["full", "stacked"] as const) {
			const rendered = await renderClipLayout(bytes, { ...defaultClipLayout, mode, textLayers: [{ field: "title", x: 5, y: 85, size: 24 }] }, { title: "hello: %{shell}; [x]'世界" }, AbortSignal.timeout(15000));
			const file = join(dir, `${mode}.mp4`);
			await writeFile(file, rendered);
			const result = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
			expect(result.streams.find((s: { codec_type: string }) => s.codec_type === "video")).toMatchObject({ width: 720, height: 1280 });
			expect(result.streams.some((s: { codec_type: string }) => s.codec_type === "audio")).toBe(true);
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}, 30000);
it("rejects invalid media and a cancelled render", async () => {
	await expect(renderClipLayout(new Uint8Array([1, 2, 3]), defaultClipLayout, { title: "bad" }, AbortSignal.timeout(5000))).rejects.toThrow();
	const controller = new AbortController();
	controller.abort();
	await expect(renderClipLayout(new Uint8Array(), defaultClipLayout, { title: "bad" }, controller.signal)).rejects.toThrow();
});

it("cleans up process failures and releases capacity for subsequent renders", async () => {
	const cp = (await import("node:child_process")).default;
	const { EventEmitter } = await import("node:events");
	const spy = jest.spyOn(cp, "spawn").mockImplementation(() => {
		const child = new EventEmitter();
		queueMicrotask(() => child.emit("error", new Error("failed to start")));
		return child as never;
	});
	try {
		for (let i = 0; i < 3; i++) await expect(renderClipLayout(new Uint8Array([1]), defaultClipLayout, { title: "T" }, AbortSignal.timeout(1000))).rejects.toThrow("render_failed");
	} finally {
		spy.mockRestore();
	}
});
it("caps concurrent renders and returns a retryable busy result", async () => {
	const cp = (await import("node:child_process")).default;
	const { EventEmitter } = await import("node:events");
	const children: InstanceType<typeof EventEmitter>[] = [];
	const spy = jest.spyOn(cp, "spawn").mockImplementation(() => {
		const child = new EventEmitter();
		children.push(child);
		return child as never;
	});
	try {
		const first = renderClipLayout(new Uint8Array([1]), defaultClipLayout, { title: "T" }, AbortSignal.timeout(5000));
		const second = renderClipLayout(new Uint8Array([1]), defaultClipLayout, { title: "T" }, AbortSignal.timeout(5000));
		const results = Promise.allSettled([first, second]);
		await expect(renderClipLayout(new Uint8Array([1]), defaultClipLayout, { title: "T" }, AbortSignal.timeout(5000))).rejects.toThrow("render_busy");
		while (children.length < 2) await new Promise((r) => setTimeout(r, 5));
		children.forEach((child) => child.emit("close", 1));
		expect((await results).every((r) => r.status === "rejected")).toBe(true);
	} finally {
		spy.mockRestore();
	}
});

it("rejects oversized or incomplete rendered output before returning media", async () => {
	const fs = (await import("node:fs/promises")).default;
	const bytes = new Uint8Array(await readFile("test/fixtures/runner/presentation.mp4"));
	const size = jest.spyOn(fs, "stat");
	try {
		for (const outputSize of [32 * 1024 * 1024, 1]) {
			size.mockResolvedValueOnce({ size: outputSize } as never);
			await expect(renderClipLayout(bytes, defaultClipLayout, { title: "Bounded output" }, AbortSignal.timeout(15000))).rejects.toThrow("file_size_limit");
		}
	} finally {
		size.mockRestore();
	}
}, 30000);
it("releases render capacity when temporary storage cannot be created", async () => {
	const fs = (await import("node:fs/promises")).default;
	const mkdir = jest.spyOn(fs, "mkdtemp").mockRejectedValue(new Error("temporary storage unavailable"));
	try {
		for (let i = 0; i < 3; i++) await expect(renderClipLayout(new Uint8Array([1]), defaultClipLayout, { title: "T" }, AbortSignal.timeout(5000))).rejects.toThrow("temporary storage unavailable");
	} finally {
		mkdir.mockRestore();
	}
});

it("renders three independent video crops and widgets in Desktop and Mobile without losing audio", async () => {
	const dir = await mkdtemp(join(tmpdir(), "clipify-composition-test-"));
	try {
		const input = join(dir, "source.mp4");
		execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=640x360:r=15", "-f", "lavfi", "-i", "sine=frequency=440", "-vf", "drawbox=x=480:y=0:w=160:h=120:color=red:t=fill,drawbox=x=0:y=270:w=320:h=90:color=lime:t=fill", "-t", "0.3", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", input]);
		const bytes = new Uint8Array(await readFile(input));
		for (const format of ["desktop", "mobile"] as const) {
			const layout = {
				version: 2 as const,
				format,
				layers: [
					{ id: "game", kind: "video" as const, label: "Game", source: { x: 0, y: 0, w: 0.5, h: 0.5 }, frame: { x: 0, y: 0, w: 0.5, h: 0.5 } },
					{ id: "camera", kind: "video" as const, label: "Camera", source: { x: 0.75, y: 0, w: 0.25, h: 1 / 3 }, frame: { x: 0.5, y: 0, w: 0.25, h: 1 / 3 } },
					{ id: "killfeed", kind: "video" as const, label: "Killfeed", source: { x: 0, y: 0.75, w: 0.5, h: 0.25 }, frame: { x: 0, y: 0.75, w: 0.5, h: 0.25 } },
					{ id: "title", kind: "title" as const, label: "Title", fontSize: 24, frame: { x: 0.5, y: 0.5, w: 0.5, h: 0.2 } },
				],
			};
			const output = await renderClipLayout(bytes, layout as any, { title: "literal %{shell}; [x]' title" }, AbortSignal.timeout(15000));
			const file = join(dir, `${format}.mp4`);
			await writeFile(file, output);
			const streams = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", file], { encoding: "utf8" })).streams;
			const width = format === "desktop" ? 1280 : 720,
				height = format === "desktop" ? 720 : 1280;
			expect(streams.find((s: any) => s.codec_type === "video")).toMatchObject({ width, height });
			expect(streams.some((s: any) => s.codec_type === "audio")).toBe(true);
			const rgb = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 5 * 1024 * 1024 });
			for (const [x, y, color] of [
				[0.25, 0.25, 2],
				[0.625, 1 / 6, 0],
				[0.25, 0.875, 1],
			]) {
				const offset = (Math.floor(y * height) * width + Math.floor(x * width)) * 3;
				expect(rgb[offset + color]).toBeGreaterThan(200);
				expect(rgb[offset + ((color + 1) % 3)]).toBeLessThan(30);
			}
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}, 30000);
it("renders the authorized channel logo and rejects untrusted or non-image logo sources", async () => {
	const dir = await mkdtemp(join(tmpdir(), "clipify-logo-test-"));
	const originalFetch = globalThis.fetch;
	try {
		const input = join(dir, "source.mp4"),
			logo = join(dir, "logo.png");
		execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=15", "-t", "0.2", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-y", input]);
		execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=white:s=16x16", "-frames:v", "1", "-threads", "1", "-y", logo]);
		const bytes = new Uint8Array(await readFile(input)),
			image = new Uint8Array(await readFile(logo));
		const fetchMock = jest.fn().mockResolvedValue(new Response(image, { headers: { "content-type": "image/png" } }));
		globalThis.fetch = fetchMock;
		const { createClipComposition } = await import("@lib/clipComposition");
		const layout = createClipComposition("desktop");
		layout.layers.push({ id: "logo", kind: "logo", label: "Channel logo", frame: { x: 0.5, y: 0.1, w: 0.2, h: (0.2 * 1280) / 720 } });
		layout.layers.push({ id: "channel", kind: "channel", label: "Channel name", fontSize: 24, frame: { x: 0.1, y: 0.6, w: 0.75, h: 0.18 } });
		const avatar = "https://static-cdn.jtvnw.net/jtv_user_pictures/fixture-profile_image-300x300.png";
		const rendered = await renderClipLayout(bytes, layout, { title: "Logo", broadcasterName: "Streamer" }, AbortSignal.timeout(15000), { avatar });
		const out = join(dir, "logo-output.mp4");
		await writeFile(out, rendered);
		const rgb = execFileSync("ffmpeg", ["-v", "error", "-i", out, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 5 * 1024 * 1024 });
		const badgeAvatar = (480 * 1280 + 180) * 3;
		expect([...rgb.subarray(badgeAvatar, badgeAvatar + 3)].every((n) => n > 230)).toBe(true);
		const badgeBackground = (450 * 1280 + 1000) * 3;
		expect(rgb[badgeBackground]).toBeLessThan(30);
		expect(rgb[badgeBackground + 2]).toBeGreaterThan(40);
		expect(rgb[badgeBackground + 2]).toBeLessThan(130);
		const offset = (200 * 1280 + 760) * 3;
		expect([...rgb.subarray(offset, offset + 3)].every((n) => n > 230)).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith(new URL(avatar), expect.objectContaining({ redirect: "manual", cache: "no-store" }));
		const fallback = await renderClipLayout(bytes, { ...layout, widgetTheme: { themeTextColor: "#000000", themeBackgroundColor: "#ffffff", themeAccentColor: "#7C3AED", borderSize: 0, borderRadius: 10 }, layers: layout.layers.filter((layer) => layer.kind !== "logo") }, { title: "No avatar" }, AbortSignal.timeout(15000));
		const fallbackPath = join(dir, "fallback.mp4");
		await writeFile(fallbackPath, fallback);
		const fallbackPixels = execFileSync("ffmpeg", ["-v", "error", "-i", fallbackPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 5 * 1024 * 1024 });
		expect(fallbackPixels[(496 * 1280 + 155) * 3]).toBeGreaterThan(80);
		expect([...fallbackPixels.subarray(badgeBackground, badgeBackground + 3)].every((n) => n > 230)).toBe(true);
		await expect(renderClipLayout(bytes, layout, { title: "Bad" }, AbortSignal.timeout(1000), { avatar: "http://127.0.0.1/private" })).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		fetchMock.mockResolvedValueOnce(new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
		await expect(renderClipLayout(bytes, layout, { title: "Bad" }, AbortSignal.timeout(1000), { avatar })).rejects.toThrow();
	} finally {
		globalThis.fetch = originalFetch;
		await rm(dir, { recursive: true, force: true });
	}
}, 30000);

it("normalizes JPEG/WebP logos and rejects spoofed, oversized or inaccessible image sources", async () => {
	const originalFetch = globalThis.fetch;
	const fetchMock = jest.fn();
	globalThis.fetch = fetchMock;
	const { readClipCompositionLogo } = await import("../../src/server/clip-composition-render");
	const sharp = (await import("sharp")).default;
	const avatar = "https://static-cdn.jtvnw.net/logo";
	const signal = AbortSignal.timeout(15000);
	try {
		for (const format of ["jpeg", "webp"] as const) {
			const bytes = await sharp({ create: { width: 16, height: 8, channels: 3, background: "#fff" } })
				[format]()
				.toBuffer();
			fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(bytes), { headers: { "content-type": `image/${format}; charset=binary` } }));
			const logo = await readClipCompositionLogo(avatar, signal);
			expect(await sharp(logo).metadata()).toMatchObject({ format: "png", width: 16, height: 8 });
		}
		for (const url of [undefined, "https://user:pass@static-cdn.jtvnw.net/logo", "https://static-cdn.jtvnw.net:444/logo", "https://private.invalid/logo"]) await expect(readClipCompositionLogo(url, signal)).rejects.toThrow();
		for (const response of [new Response(null, { status: 404 }), new Response("x"), new Response("x", { headers: { "content-type": "image/png" } }), new Response(new Uint8Array([137, 80, 78, 71, 0, 0, 0, 0, 0, 0, 0, 0]), { headers: { "content-type": "image/png" } })]) {
			fetchMock.mockResolvedValueOnce(response);
			await expect(readClipCompositionLogo(avatar, signal)).rejects.toThrow();
		}
		const oversized = await sharp({ create: { width: 1001, height: 1000, channels: 3, background: "#fff" } })
			.png()
			.toBuffer();
		fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(oversized), { headers: { "content-type": "image/png" } }));
		await expect(readClipCompositionLogo(avatar, signal)).rejects.toThrow();
	} finally {
		globalThis.fetch = originalFetch;
	}
}, 30000);

it("burns the non-layer watermark into composed pixels and lets the account brand override local colors", async () => {
	const { createClipComposition } = await import("@lib/clipComposition");
	const { creatorBrandSchema, DEFAULT_WIDGET_THEME } = await import("@lib/overlayMetadata");
	const sharp = (await import("sharp")).default;
	const dir = await mkdtemp(join(tmpdir(), "clipify-brand-pixel-"));
	try {
		const input = join(dir, "source.mp4");
		execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=black:size=640x360:rate=15", "-t", "0.2", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-y", input]);
		const layout = createClipComposition("desktop");
		layout.layers.push({ id: "title", kind: "title", label: "Clip info", fontSize: 32, frame: { x: 0, y: 0, w: 0.5, h: 0.2 } });
		layout.widgetTheme = { ...DEFAULT_WIDGET_THEME, themeBackgroundColor: "#ffffff" };
		const bytes = new Uint8Array(await readFile(input));
		const brand = creatorBrandSchema.parse({ themeBackgroundColor: "#ff0000" });
		const samples = [];
		for (const watermark of [false, true]) {
			const result = await renderClipLayout(bytes, layout, { title: "A clip" }, AbortSignal.timeout(20000), { brand, watermark });
			const file = join(dir, `${watermark}.mp4`);
			await writeFile(file, result);
			const png = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]);
			const pixel = await sharp(png).extract({ left: 100, top: 100, width: 1, height: 1 }).raw().toBuffer();
			expect(pixel[0]).toBeGreaterThan(200);
			expect(pixel[1]).toBeLessThan(30);
			const patch = await sharp(png).extract({ left: 1060, top: 650, width: 204, height: 54 }).removeAlpha().raw().toBuffer();
			samples.push(patch.reduce((sum, value) => sum + value, 0) / patch.length);
		}
		layout.layers[1] = { ...layout.layers[1], appearance: { themeBackgroundColor: "#00ff00", borderRadius: 24 } } as (typeof layout.layers)[number];
		const overridden = await renderClipLayout(bytes, layout, { title: "A clip" }, AbortSignal.timeout(20000), { brand });
		const overriddenFile = join(dir, "override.mp4");
		await writeFile(overriddenFile, overridden);
		const png = execFileSync("ffmpeg", ["-v", "error", "-i", overriddenFile, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]);
		const green = await sharp(png).extract({ left: 100, top: 100, width: 1, height: 1 }).raw().toBuffer();
		expect(green[1]).toBeGreaterThan(200);
		expect(green[0]).toBeLessThan(30);

		expect(samples[1]).toBeGreaterThan(samples[0] + 5);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}, 45000);

it("keeps Channel info exportable when its optional avatar is unavailable, while requiring explicit logo assets", async () => {
	const { compositionFilterGraph } = await import("@/server/clip-composition-render");
	const { createClipComposition } = await import("@lib/clipComposition");
	const dir = await mkdtemp(join(tmpdir(), "clipify-avatar-fallback-"));
	const fetcher = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
	const layout = createClipComposition("desktop");
	layout.layers.push({ id: "channel", kind: "channel", label: "Channel info", fontSize: 32, frame: { x: 0, y: 0, w: 0.5, h: 0.15 } });
	try {
		await compositionFilterGraph(layout, dir, { title: "Clip", broadcasterName: "Creator" }, AbortSignal.timeout(5000), "https://static-cdn.jtvnw.net/missing.png");
		const fallback = await readFile(join(dir, "widget-1.png"));
		await compositionFilterGraph(layout, dir, { title: "Clip", broadcasterName: "Creator" }, AbortSignal.timeout(5000));
		expect(fallback.equals(await readFile(join(dir, "widget-1.png")))).toBe(true);
		layout.layers.push({ id: "logo", kind: "logo", label: "Logo", frame: { x: 0, y: 0.5, w: 0.1, h: 0.1 } });
		await expect(compositionFilterGraph(layout, dir, { title: "Clip" }, AbortSignal.timeout(5000), "https://static-cdn.jtvnw.net/missing.png")).rejects.toThrow("render_failed");
		layout.layers.pop();
		const stopped = new AbortController();
		fetcher.mockImplementation(async () => {
			stopped.abort();
			throw Error("aborted");
		});
		await expect(compositionFilterGraph(layout, dir, { title: "Clip" }, stopped.signal, "https://static-cdn.jtvnw.net/missing.png")).rejects.toThrow("aborted");
	} finally {
		fetcher.mockRestore();
		await rm(dir, { recursive: true, force: true });
	}
});
