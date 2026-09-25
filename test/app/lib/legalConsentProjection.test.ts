/** @jest-environment node */

import { projectConsentCategories } from "@lib/legal/consentProjection";

describe("legal consent projection", () => {
	it("projects existing categories without creating consent state", () => {
		const selections = Object.freeze({ necessary: true, functionality: false, measurement: true });

		const projection = projectConsentCategories(selections);

		expect(projection.map(({ id, selected }) => ({ id, selected }))).toEqual([
			{ id: "necessary", selected: true },
			{ id: "functionality", selected: false },
			{ id: "measurement", selected: true },
		]);
		expect(projection.every((category) => category.title && category.description && category.services.length > 0)).toBe(true);
		expect(selections).toEqual({ necessary: true, functionality: false, measurement: true });
	});
});
