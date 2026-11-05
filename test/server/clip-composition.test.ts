/** @jest-environment node */
import { compositionSchema, resizeCompositionRect, snapCompositionRect, convertLegacyClipLayout, createClipComposition, updateCompositionSource } from "@lib/clipComposition";
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

it("changes captured content without using output movement to crop and updates the output aspect on source resize", () => {
	const layout = createClipComposition("desktop");
	const next = updateCompositionSource(layout, "gameplay", { x: 0, y: 0, w: 400 / 1920, h: 200 / 1080 }, { width: 1920, height: 1080 });
	const layer = next.layers[0];
	expect(layer.kind).toBe("video");
	expect((layer.frame.w * 1280) / (layer.frame.h * 720)).toBeCloseTo(2);
	expect(layout.layers[0].frame).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	expect(compositionSchema.safeParse(next).success).toBe(true);
});
it("keeps thin killfeed crops valid without stretching their output aspect", () => {
	const next = updateCompositionSource(createClipComposition("mobile"), "gameplay", { x: 0, y: 0, w: 1, h: 0.002 }, { width: 1920, height: 1080 });
	expect(compositionSchema.safeParse(next).success).toBe(true);
});
