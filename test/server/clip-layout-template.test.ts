/** @jest-environment node */
import { templateCompositions, templateCompositionsSchema, compositionLayerColor } from "@lib/clipLayoutTemplate";
import { createClipComposition } from "@lib/clipComposition";
it("imports either existing format without losing its crops and preserves paired compositions", () => {
	for (const format of ["desktop", "mobile"] as const) {
		const composition = createClipComposition(format);
		const pair = templateCompositions({ composition });
		expect(pair[format]).toBe(composition);
		expect(pair.desktop.format).toBe("desktop");
		expect(pair.mobile.format).toBe("mobile");
		expect(templateCompositionsSchema.safeParse(pair).success).toBe(true);
		expect(templateCompositions({ composition, compositions: pair })).toBe(pair);
	}
	expect(templateCompositionsSchema.safeParse({ desktop: createClipComposition("mobile"), mobile: createClipComposition("desktop") }).success).toBe(false);
});
it("uses stable matching layer colors in the source, output and layer list", () => {
	expect(compositionLayerColor("camera")).toBe(compositionLayerColor("camera"));
	expect(compositionLayerColor("camera")).not.toBe(compositionLayerColor("gameplay"));
	expect(compositionLayerColor("title")).toMatch(/^hsl\(/);
});

it("keeps 32 layer identities distinct and does not change colors when stacking order changes", () => {
	const ids = Array.from({ length: 32 }, (_, i) => `layer-${i}`);
	expect(new Set(ids.map((id) => compositionLayerColor(id))).size).toBe(32);
	for (const id of ids) expect(compositionLayerColor(id)).toBe(compositionLayerColor(id));
});

it("keeps existing colors when adding or removing any other layer", () => {
	const ids = ["camera", "gameplay", "custom-1"];
	const before = Object.fromEntries(ids.map((id) => [id, compositionLayerColor(id)]));
	const after = Object.fromEntries(["a-new-layer", ...ids, "z-another-layer"].map((id) => [id, compositionLayerColor(id)]));
	expect(after).toMatchObject(before);
});
