/** @jest-environment node */

import { privacyPolicySections } from "@lib/legal/documents";

describe("privacy policy content", () => {
	it("covers every required privacy and processing topic", () => {
		const sectionIds = privacyPolicySections.map((section) => section.id);

		expect(sectionIds).toEqual(["controller-and-contact", "data-categories-and-sources", "purposes-and-legal-bases", "account-authentication", "twitch-integrations", "payments", "communications-and-support", "security-and-consent-records", "analytics-observability-and-logs", "cookies-and-storage", "recipients-and-processors", "international-transfers", "retention", "individual-rights", "automated-decisions", "children", "complaint-routes", "material-changes"]);
		for (const section of privacyPolicySections) {
			expect(section.title.trim()).not.toBe("");
			expect(section.summary.trim()).not.toBe("");
		}
		expect(privacyPolicySections.flatMap(({ details = [], items = [] }) => [...details, ...items]).length).toBeGreaterThan(35);
	});
});
