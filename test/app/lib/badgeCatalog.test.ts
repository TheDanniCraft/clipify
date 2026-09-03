import { badgeCatalog, badgeIconKeys, badgeSlugs, isBadgeSlug } from "@lib/badgeCatalog";
import { badgeEnum } from "@/db/schema";

describe("badge catalog", () => {
	it("centrally defines every badge's presentation", () => {
		for (const [slug, badge] of Object.entries(badgeCatalog)) {
			expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			expect(badge.name).not.toBe("");
			expect(badge.description).not.toBe("");
			expect(badgeIconKeys).toContain(badge.icon);
			expect(Number.isInteger(badge.priority)).toBe(true);
		}
	});
	it("accepts catalog slugs and rejects arbitrary database values", () => {
		expect(isBadgeSlug("founder")).toBe(true);
		expect(isBadgeSlug("beta-tester")).toBe(true);
		expect(isBadgeSlug("partner")).toBe(true);
		expect(isBadgeSlug("contributor")).toBe(true);
		expect(isBadgeSlug("beta-member-test")).toBe(false);
		expect(isBadgeSlug("constructor")).toBe(false);
		expect(isBadgeSlug("made-up-badge")).toBe(false);
	});
	it("derives the PostgreSQL enum values from the registry", () => {
		expect(badgeSlugs).toEqual(["founder", "founder-supporter", "partner", "beta-tester", "contributor"]);
		expect(badgeSlugs).toEqual(Object.keys(badgeCatalog));
		expect(badgeEnum.enumValues).toEqual(badgeSlugs);
	});
});
