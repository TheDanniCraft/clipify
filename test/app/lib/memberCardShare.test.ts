import { clipifyShareDescription, memberCardShareText } from "@lib/memberCardShare";

describe("member card share copy", () => {
	it.each([null, 0])("does not claim an assigned member number for %s", (number) => {
		const text = memberCardShareText("clipper", number, true);
		expect(text).toContain("I'm part of the Clipify community!");
		expect(text).not.toContain("member #");
		expect(text).toContain(clipifyShareDescription);
	});
	it("does not claim ownership when a visitor shares another member's card", () => {
		const text = memberCardShareText("clipper", 20, false);
		expect(text).toContain("Meet clipper from the Clipify community — member #20!");
		expect(text).toContain("Part of the community:");
		expect(text).not.toContain("I'm");
	});
	it("keeps normal owner posts within X's text budget with a shortened link", () => {
		expect(Array.from(memberCardShareText("clipper", 123456789, true)).length + 1 + 23).toBeLessThanOrEqual(280);
	});
});
