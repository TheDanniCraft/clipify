import { isTitleBlocked } from "@/app/utils/regexFilter";

describe("utils/regexFilter", () => {
	it("blocks titles when at least one blacklist regex matches", () => {
		expect(isTitleBlocked("Insane HEADSHOT clip", ["headshot"])).toBe(true);
	});

	it("ignores invalid regex entries and keeps evaluating valid ones", () => {
		expect(isTitleBlocked("pog moment", ["[", "pog"])).toBe(true);
		expect(isTitleBlocked("normal title", ["["])).toBe(false);
	});

	it("returns false for empty blacklist", () => {
		expect(isTitleBlocked("anything", [])).toBe(false);
	});

	it("skips empty string entries in blacklist", () => {
		expect(isTitleBlocked("pog", ["", " "])).toBe(false);
		expect(isTitleBlocked("pog", [" ", "pog"])).toBe(true);
	});
});
