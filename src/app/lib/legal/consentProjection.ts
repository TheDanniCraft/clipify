import { consentCategoryDetails, consentServices, necessaryConsentServices } from "@lib/consent/registry";

export type ConsentSelections = Readonly<Record<"necessary" | "functionality" | "measurement", boolean>>;

const categoryIds = ["necessary", "functionality", "measurement"] as const;

export function projectConsentCategories(selections: ConsentSelections) {
	const services = [...necessaryConsentServices, ...consentServices];

	return categoryIds.map((id) => ({
		id,
		title: consentCategoryDetails[id].title,
		description: consentCategoryDetails[id].description,
		selected: selections[id],
		userConfigurable: id !== "necessary",
		services: services.filter((service) => service.category === id),
	}));
}

/** Analytics is optional; no audience-measurement service is always on. */
export function getAlwaysOnServiceDisclosures() {
	return [] as const;
}
