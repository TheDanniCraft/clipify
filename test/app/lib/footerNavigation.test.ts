/** @jest-environment node */

import { footerNavigation } from "@lib/footerNavigation";

describe("footer navigation", () => {
	it("uses root-page anchors for landing-page sections", () => {
		expect(footerNavigation.features.every(({ href }) => href === "/#features")).toBe(true);
		expect(footerNavigation.supportOptions.find(({ name }) => name === "FAQs")?.href).toBe("/#faq");
	});
});
