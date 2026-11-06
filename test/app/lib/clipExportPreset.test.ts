/** @jest-environment node */
import { exportPresetSchema, exportEncoding, encodeForPreset } from "@lib/clipExportPreset";
import { createClipExportPlan, clipExportPlanSchema } from "@lib/clipExportPlan";
it("uses duration and reserves audio/container space instead of a fixed low bitrate", () => {
	const short = exportEncoding({ id: "discord" }, 10),
		long = exportEncoding({ id: "discord" }, 60);
	expect(short.videoBitrate).toBeGreaterThan(long.videoBitrate);
	expect(((long.videoBitrate + long.audioBitrate) * 60) / 8).toBeLessThan(20_000_000);
	expect(long.maxBytes).toBe(20_000_000);
});
it("validates custom targets and never expands the existing media memory ceiling", () => {
	for (const value of [{ id: "other" }, { id: "custom" }, { id: "custom", maxSizeMB: NaN }, { id: "custom", maxSizeMB: 0 }, { id: "custom", maxSizeMB: 33 }]) expect(exportPresetSchema.safeParse(value).success).toBe(false);
	expect(exportEncoding({ id: "custom", maxSizeMB: 1 }, 30).maxBytes).toBe(1_000_000);
	expect(exportEncoding({ id: "youtube" }, 60).maxBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
	for (const duration of [0, -1, NaN, Infinity]) expect(() => exportEncoding({ id: "discord" }, duration)).toThrow();
});
it("checks actual bytes and retries with a lower bitrate, returning only a fitting complete result", async () => {
	const render = jest.fn().mockResolvedValueOnce(new Uint8Array(1_100_000)).mockResolvedValueOnce(new Uint8Array(900_000));
	const result = await encodeForPreset({ id: "custom", maxSizeMB: 1 }, 10, new AbortController().signal, render);
	expect(result.length).toBe(900_000);
	expect(render).toHaveBeenCalledTimes(2);
	expect(render.mock.calls[1][0].videoBitrate).toBeLessThan(render.mock.calls[0][0].videoBitrate);
});
it("bounds retry work and does not swallow cancellation or unrelated encoding failures", async () => {
	const render = jest.fn().mockResolvedValue(new Uint8Array(1_100_000));
	await expect(encodeForPreset({ id: "custom", maxSizeMB: 1 }, 10, new AbortController().signal, render)).rejects.toThrow("preset_size_limit");
	expect(render).toHaveBeenCalledTimes(3);
	const fail = jest.fn().mockRejectedValue(Error("render_failed"));
	await expect(encodeForPreset({ id: "discord" }, 30, new AbortController().signal, fail)).rejects.toThrow("render_failed");
	const controller = new AbortController();
	controller.abort();
	await expect(encodeForPreset({ id: "discord" }, 30, controller.signal, fail)).rejects.toThrow();
	expect(fail).toHaveBeenCalledTimes(1);
});
it("snapshots the selected preset in every processing packet and rejects forged preset input", () => {
	const plans = createClipExportPlan(
		"creator",
		Array.from({ length: 51 }, (_, i) => `Clip${i}`),
		[{ key: "original", label: "Original" }],
		{ id: "discord" },
	);
	expect(plans).toHaveLength(2);
	expect(plans.every((p) => p.preset?.id === "discord")).toBe(true);
	expect(clipExportPlanSchema.safeParse({ ...plans[0], preset: { id: "forged" } }).success).toBe(false);
});

it("reduces bitrate after a bounded encoder overflow and budgets actual copied audio", async () => {
	const render = jest.fn().mockRejectedValueOnce(Error("file_size_limit")).mockResolvedValue(new Uint8Array(500000));
	await expect(encodeForPreset({ id: "custom", maxSizeMB: 1 }, 10, new AbortController().signal, render, 256000)).resolves.toHaveLength(500000);
	expect(render.mock.calls[0][0].audioBitrate).toBe(256000);
	expect(render.mock.calls[1][0].videoBitrate).toBeLessThan(render.mock.calls[0][0].videoBitrate);
	expect(() => exportEncoding({ id: "custom", maxSizeMB: 1 }, 1000)).toThrow("preset_size_limit");
	expect(() => exportEncoding({ id: "general" }, 10, NaN)).toThrow("invalid_media");
	expect(exportEncoding({ id: "youtube" }, 10).audioBitrate).toBe(192000);
});
it("does not publish a finished video if cancellation arrives during encoding", async () => {
	const controller = new AbortController();
	const render = jest.fn(async () => {
		controller.abort();
		return new Uint8Array(500000);
	});
	await expect(encodeForPreset({ id: "discord" }, 10, controller.signal, render)).rejects.toThrow();
	expect(render).toHaveBeenCalledTimes(1);
});
