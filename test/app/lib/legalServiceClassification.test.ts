/** @jest-environment node */

import { getAlwaysOnServiceDisclosures, projectConsentCategories } from "@lib/legal/consentProjection";

describe("legal service classification", () => {
	it("discloses necessary and cookieless measurement truthfully", () => {
		const categories = projectConsentCategories({ necessary: true, functionality: false, measurement: false });
		const necessary = categories.find((category) => category.id === "necessary");
		const plausible = getAlwaysOnServiceDisclosures().find((service) => service.id === "plausible");

		expect(necessary).toEqual(expect.objectContaining({ selected: true, userConfigurable: false }));
		expect(plausible).toEqual(
			expect.objectContaining({
				alwaysOn: true,
				consentRequired: false,
				optionalToggle: false,
				storageDeclarations: [],
			}),
		);
	});
});
