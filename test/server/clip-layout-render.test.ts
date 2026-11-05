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
