/** @jest-environment node */
import { compositionSchema, resizeCompositionRect, snapCompositionRect, convertLegacyClipLayout, createClipComposition, updateCompositionFrame, updateCompositionSource } from "@lib/clipComposition";
it("validates independent gameplay, camera, killfeed and widget layers in either output format", () => {
	const video = (id: string) => ({ id, kind: "video", label: id, source: { x: 0, y: 0, w: 0.5, h: 0.5 }, frame: { x: 0, y: 0, w: 0.5, h: 0.5 } });
	for (const format of ["mobile", "desktop"]) {
		expect(compositionSchema.parse({ version: 2, format, layers: [video("gameplay"), video("camera"), video("killfeed"), { id: "channel", kind: "channel", label: "Channel name", frame: { x: 0, y: 0, w: 0.5, h: 0.1 }, fontSize: 24 }] }).layers).toHaveLength(4);
	}
	expect(compositionSchema.safeParse({ version: 2, format: "mobile", layers: [video("same"), video("same")] }).success).toBe(false);
	expect(compositionSchema.safeParse({ version: 2, format: "mobile", layers: [{ ...video("outside"), source: { x: 0.8, y: 0, w: 0.5, h: 1 } }] }).success).toBe(false);
});

it("resizes output frames with their original aspect ratio and bounds", () => {
	const frame = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 };
	const larger = resizeCompositionRect(frame, 0.4, 0.2, "se", 2);
	expect(larger).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.4 });
	const bounded = resizeCompositionRect(frame, 4, 4, "se", 2);
	expect(bounded.x + bounded.w).toBeLessThanOrEqual(1);
	expect(bounded.y + bounded.h).toBeLessThanOrEqual(1);
	expect(bounded.w / bounded.h).toBeCloseTo(2);
	expect(resizeCompositionRect(frame, -0.05, -0.1, "nw")).toEqual({ x: 0.05, y: 0, w: 0.45, h: 0.3 });
});
it("snaps output edges and centers to the canvas and neighboring layers", () => {
	const layer = { x: 0.005, y: 0.255, w: 0.2, h: 0.2 };
	const snapped = snapCompositionRect(layer, [{ x: 0.6, y: 0.05, w: 0.2, h: 0.2 }], 0.01, 0.01);
	expect(snapped.rect.x).toBe(0);
	expect(snapped.rect.y).toBeCloseTo(0.25);
	expect(snapped.guides).toEqual({ x: 0, y: 0.25 });
	expect(snapCompositionRect({ ...layer, x: 0.14, y: 0.34 }, [], 0.01, 0.01).rect).toEqual({ ...layer, x: 0.14, y: 0.34 });
});

it("converts saved stacked framing and supplies reusable desktop/mobile starters", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	const converted = convertLegacyClipLayout(defaultClipLayout);
	expect(converted.format).toBe("mobile");
	expect(converted.layers.map((layer) => layer.id)).toEqual(["camera", "gameplay"]);
	const [camera, gameplay] = converted.layers;
	expect(camera.frame.h * 1280).toBe(426);
	expect(gameplay.frame.y * 1280).toBe(426);
	expect(gameplay.frame.h * 1280).toBe(854);
	expect(compositionSchema.safeParse(converted).success).toBe(true);
	expect(createClipComposition("desktop").layers[0].frame).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	expect(createClipComposition("mobile").format).toBe("mobile");
});

it("keeps output placement and shape fixed when selecting source content", () => {
	const layout = createClipComposition("desktop");
	const next = updateCompositionSource(layout, "gameplay", { x: 0, y: 0, w: 400 / 1920, h: 200 / 1080 }, { width: 1920, height: 1080 });
	const layer = next.layers[0];
	expect(layer.kind).toBe("video");
	expect((layer.frame.w * 1280) / (layer.frame.h * 720)).toBeCloseTo(16 / 9);
	expect(layer.frame).toEqual(layout.layers[0].frame);
	expect(layout.layers[0].frame).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	expect(compositionSchema.safeParse(next).success).toBe(true);
});
it("keeps thin killfeed crops valid without stretching their output aspect", () => {
	const next = updateCompositionSource(createClipComposition("mobile"), "gameplay", { x: 0, y: 0, w: 1, h: 0.002 }, { width: 1920, height: 1080 });
	expect(compositionSchema.safeParse(next).success).toBe(true);
});

it("lets the output determine a custom shape and matches its source crop", () => {
	const next = updateCompositionFrame(createClipComposition("desktop"), "gameplay", { x: 0, y: 0, w: 0.5, h: 0.6 }, { width: 1920, height: 1080 });
	const layer = next.layers[0];
	if (layer.kind !== "video") throw Error("Expected video");
	expect(layer.source.w / layer.source.h).toBeCloseTo(0.5 / 0.6, 5);
	expect(compositionSchema.safeParse(next).success).toBe(true);
	expect(resizeCompositionRect({ x: 0.1, y: 0.1, w: 0.4, h: 0.2 }, 0.2, 0, "e")).toEqual({ x: 0.1, y: 0.1, w: 0.6, h: 0.2 });
});

it.each(["n", "s", "e", "w", "nw", "ne", "sw", "se"] as const)("keeps %s resize handles bounded with and without a shape lock", (handle) => {
	const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.2 };
	for (const ratio of [undefined, 2]) {
		const result = resizeCompositionRect(start, 0.1, 0.08, handle, ratio);
		expect(result.x).toBeGreaterThanOrEqual(0);
		expect(result.y).toBeGreaterThanOrEqual(0);
		expect(result.x + result.w).toBeLessThanOrEqual(1);
		expect(result.y + result.h).toBeLessThanOrEqual(1);
		if (ratio) expect(result.w / result.h).toBeCloseTo(ratio, 4);
		if (handle.includes("w")) expect(result.x + result.w).toBeCloseTo(start.x + start.w, 5);
		if (handle.includes("n")) expect(result.y + result.h).toBeCloseTo(start.y + start.h, 5);
	}
});

it("keeps minimal-width output strips saveable at the source pixel bound", () => {
	const next = updateCompositionFrame(createClipComposition("mobile"), "gameplay", { x: 0, y: 0, w: 0.002, h: 1 }, { width: 1920, height: 1080 });
	expect(compositionSchema.safeParse(next).success).toBe(true);
});
