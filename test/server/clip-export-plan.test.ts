/** @jest-environment node */
import { createClipExportPlan, clipExportPlanSchema } from "@lib/clipExportPlan";
import { createClipComposition } from "@lib/clipComposition";
it("plans every clip/version pair once in clip order and splits at fifty files", () => {
	const outputs = [
		{ key: "original", label: "Original" },
		{ key: "desktop", label: "Desktop main", layout: createClipComposition("desktop") },
		{ key: "mobile1", label: "Mobile camera", layout: createClipComposition("mobile") },
		{ key: "mobile2", label: "Mobile gameplay", layout: createClipComposition("mobile") },
	];
	const ids = Array.from({ length: 13 }, (_, i) => `Clip${i}`);
	const batches = createClipExportPlan("owner", ids, outputs);
	expect(batches.map((batch) => batch.files.length)).toEqual([50, 2]);
	expect(batches[0].files.slice(0, 4)).toEqual(outputs.map((output) => ({ clipId: "Clip0", outputKey: output.key })));
	expect(batches.every((batch) => clipExportPlanSchema.safeParse(batch).success)).toBe(true);
	outputs[1].label = "Changed";
	expect(batches[0].outputs[1].label).toBe("Desktop main");
	expect(clipExportPlanSchema.safeParse({ ...batches[0], files: [batches[0].files[0], batches[0].files[0]] }).success).toBe(false);
	expect(clipExportPlanSchema.safeParse({ ...batches[0], files: [{ clipId: "Clip0", outputKey: "missing" }] }).success).toBe(false);
});
it("rejects invalid selections before building queue packets", () => {
	for (const [creator, clips, outputs] of [
		["", ["ClipA"], [{ key: "original", label: "Original" }]],
		["owner", [], [{ key: "original", label: "Original" }]],
		["owner", ["ClipA"], []],
		["owner", Array.from({ length: 501 }, (_, i) => `Clip${i}`), [{ key: "original", label: "Original" }]],
		[
			"owner",
			["ClipA"],
			[
				{ key: "same", label: "One" },
				{ key: "same", label: "Two" },
			],
		],
	] as const)
		expect(() =>
			createClipExportPlan(
				creator,
				[...clips],
				outputs.map((output) => ({ ...output })),
			),
		).toThrow();
});
it("bounds the complete queue and rejects unknown or duplicated file versions", async () => {
	const { clipExportPlanSchema } = await import("@lib/clipExportPlan");
	const output = { key: "original", label: "Original" };
	expect(clipExportPlanSchema.safeParse({ creatorId: "owner", outputs: [output], files: [{ clipId: "ClipA", outputKey: "missing" }] }).success).toBe(false);
	expect(
		clipExportPlanSchema.safeParse({
			creatorId: "owner",
			outputs: [output],
			files: [
				{ clipId: "ClipA", outputKey: "original" },
				{ clipId: "ClipA", outputKey: "original" },
			],
		}).success,
	).toBe(false);
	expect(() =>
		createClipExportPlan(
			"owner",
			Array.from({ length: 500 }, (_, i) => `Clip${i}`),
			Array.from({ length: 21 }, (_, i) => ({ key: `layout${i}`, label: `Layout ${i}` })),
		),
	).toThrow();
});
