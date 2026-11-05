/** @jest-environment node */
import { clipLayoutSchema, sourceCrop, defaultClipLayout } from "@lib/clipLayout";
it("rejects off-canvas, nonfinite, undersized and invalid split layouts", () => {
	for (const change of [{ gameplay: { x: 0.9, y: 0, w: 0.5, h: 1 } }, { gameplay: { x: NaN, y: 0, w: 1, h: 1 } }, { gameplay: { x: 0, y: 0, w: 0, h: 1 } }, { cameraShare: 0 }, { cameraShare: 0.9 }]) expect(clipLayoutSchema.safeParse({ ...defaultClipLayout, ...change }).success).toBe(false);
});
it("uses cover framing without stretching or escaping the source crop", () => {
	const r = sourceCrop({ x: 0, y: 0, w: 1, h: 1 }, 1920, 1080, 720, 1280);
	expect(r.h).toBe(1080);
	expect(r.w).toBeCloseTo(607.5);
	expect(r.x).toBeCloseTo(656.25);
	const camera = sourceCrop({ x: 0.75, y: 0, w: 0.25, h: 0.3 }, 1920, 1080, 720, 426);
	expect(camera.x).toBeGreaterThanOrEqual(1440);
	expect(camera.x + camera.w).toBeLessThanOrEqual(1920);
	expect(camera.y + camera.h).toBeLessThanOrEqual(324);
});
it("bounds and validates metadata layers before rendering", () => {
	expect(clipLayoutSchema.safeParse({ ...defaultClipLayout, textLayers: [{ field: "title", x: 101, y: 5, size: 30 }] }).success).toBe(false);
	expect(clipLayoutSchema.safeParse({ ...defaultClipLayout, textLayers: [{ field: "command", x: 5, y: 5, size: 30 }] }).success).toBe(false);
	expect(clipLayoutSchema.safeParse(defaultClipLayout).success).toBe(true);
});

it("wraps long credits consistently within three bounded lines", async () => {
	const { clipLayerLines, clipLayerText } = await import("@lib/clipLayout");
	const lines = clipLayerLines("W".repeat(100), 48);
	expect(lines).toHaveLength(3);
	expect(lines.every((line) => Array.from(line).length <= 14)).toBe(true);
	expect(lines[2].endsWith("…")).toBe(true);
	expect(clipLayerText("clipper", { title: "T", clipCreatorName: "A\nB" })).toBe("A B");
});
it("handles missing credits, Unicode and full-width crops without changing aspect", async () => {
	const { clipLayerText } = await import("@lib/clipLayout");
	expect(clipLayerText("channel", { title: "T" })).toBe("");
	expect(clipLayerText("title", { title: "你好" })).toBe("你好");
	expect(sourceCrop({ x: 0, y: 0, w: 1, h: 1 }, 1080, 1920, 720, 426)).toMatchObject({ x: 0, w: 1080 });
});
