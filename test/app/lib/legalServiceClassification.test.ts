/** @jest-environment node */
import { getAlwaysOnServiceDisclosures, projectConsentCategories } from "@lib/legal/consentProjection";
test("keeps analytics optional in the legal service inventory", () => {
	const categories = projectConsentCategories({ necessary: true, functionality: false, measurement: false });
	expect(categories.find((c) => c.id === "necessary")).toMatchObject({ selected: true, userConfigurable: false });
	expect(categories.find((c) => c.id === "measurement")?.services.find((s) => s.id === "umami-product-analytics")).toMatchObject({ consentRequired: true });
	expect(getAlwaysOnServiceDisclosures()).toEqual([]);
});
