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

export function getAlwaysOnServiceDisclosures() {
	return [
		{
			id: "umami-baseline",
			name: "Umami audience statistics",
			purpose: "Produce cookieless traffic, campaign, engagement and existing product-event statistics without attaching your Clipify account.",
			alwaysOn: true,
			consentRequired: false,
			optionalToggle: false,
			storageDeclarations: [],
		},
	] as const;
}
