/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
let catalogue: any;
beforeAll(() => {
	catalogue = flowProbe("catalogue:pagination");
});
for (const name of ["list_creators", "list_overlays", "list_playlists"]) {
	test(`${name} follows default pages in stable order with no omissions or duplicates`, () => {
		const row = catalogue.outcomes.find((value: any) => value.name === name);
		const ids = row.pages.flatMap((page: any) => page.ids);
		expect(ids).toEqual(row.expected);
		expect(new Set(ids).size).toBe(ids.length);
		expect(row.pages.every((page: any) => page.ids.length <= 25 && page.safe)).toBe(true);
		expect(row.pages.at(-1).cursor).toBeNull();
	});
	test.each([1, 100])(`${name} respects page limit %s and advances its signed cursor`, (limit) => {
		const row = catalogue.boundaries.find((value: any) => value.name === name && value.limit === limit);
		expect(row.first.result.items).toHaveLength(limit);
		expect(row.first.safe).toBe(true);
		if (row.second) {
			expect(row.second.safe).toBe(true);
			expect(row.second.result.items.every((item: any) => item.id > row.first.result.items.at(-1).id)).toBe(true);
		}
	});
	test.each(["zero", "oversized", "fractional", "typed-limit", "malformed", "tampered", "unknown", "expired", "other-grant"])(`${name} rejects %s pagination input`, (mode) => {
		expect(catalogue.invalid.find((row: any) => row.name === name && row.mode === mode)).toMatchObject({ error: "INVALID_INPUT", safe: true });
	});
}
for (const name of ["list_overlays", "list_playlists"]) {
	test.each(["other-tool", "other-creator"])(`${name} rejects cursor from %s context`, (mode) => {
		expect(catalogue.invalid.find((row: any) => row.name === name && row.mode === mode)).toMatchObject({ error: "INVALID_INPUT", safe: true });
	});
	test(`${name} approved empty creator gets an empty final page`, () => {
		expect(catalogue.boundaries.find((row: any) => row.name === name && row.limit === 0).first.result).toEqual({ items: [], nextCursor: null });
	});
}
test("creator pages recheck current membership rather than copying an old approval", () => {
	expect(catalogue).toMatchObject({ removedCreatorAbsent: true, currentCount: 99 });
});
