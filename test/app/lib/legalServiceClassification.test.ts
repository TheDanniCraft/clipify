/** @jest-environment node */
import { getAlwaysOnServiceDisclosures, projectConsentCategories } from "@lib/legal/consentProjection";
test("separates basic traffic from optional account-linked analytics", () => {
	const categories = projectConsentCategories({ necessary: true, functionality: false, measurement: false });
	expect(categories.find((c) => c.id === "necessary")).toMatchObject({ selected: true, userConfigurable: false });
	expect(categories.find((c) => c.id === "measurement")?.services.find((s) => s.id === "umami-product-analytics")).toMatchObject({ consentRequired: true });
	expect(getAlwaysOnServiceDisclosures()).toEqual([expect.objectContaining({ id: "umami-baseline", alwaysOn: true, consentRequired: false, optionalToggle: false })]);
	expect(categories.find((c) => c.id === "necessary")?.services.some((s) => s.id === "umami-baseline")).toBe(false);
});
