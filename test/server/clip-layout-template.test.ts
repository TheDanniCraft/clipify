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
	expect(compositionLayerColor("title")).toMatch(/^#[a-f0-9]{6}$/);
});

it("keeps 32 layer identities distinct and does not change colors when stacking order changes", () => {
	const ids = Array.from({ length: 32 }, (_, i) => `layer-${i}`);
	expect(new Set(ids.map((id) => compositionLayerColor(id, ids))).size).toBe(32);
	for (const id of ids) expect(compositionLayerColor(id, ids)).toBe(compositionLayerColor(id, [...ids].reverse()));
});
