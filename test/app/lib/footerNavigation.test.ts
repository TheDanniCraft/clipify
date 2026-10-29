/** @jest-environment node */

import { footerNavigation } from "@lib/footerNavigation";

describe("footer navigation", () => {
	it("links feature topics to product explanations and preserves the FAQ anchor", () => {
		expect(footerNavigation.features.map(({ href }) => href)).toEqual(["/features", "/features#overlays", "/features#playlists", "/features#controls", "/features#styling"]);
		expect(footerNavigation.supportOptions.find(({ name }) => name === "FAQs")?.href).toBe("/#faq");
	});
});

it("takes collaboration enquiries to the published help-center overview", () => {
	expect(footerNavigation.aboutUs.find((item) => item.name === "Collaboration enquiries")?.href).toBe("https://help.clipify.us/hc/clipify/articles/1756597294-collaborations");
});
