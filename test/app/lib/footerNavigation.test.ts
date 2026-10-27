/** @jest-environment node */

import { footerNavigation } from "@lib/footerNavigation";

describe("footer navigation", () => {
	it("links feature topics to product explanations and preserves the FAQ anchor", () => {
		expect(footerNavigation.features.map(({ href }) => href)).toEqual(["/features", "/guides/twitch-clips-in-obs", "/guides/twitch-clip-playlists", "/guides/control-twitch-clip-playback", "/features#styling"]);
		expect(footerNavigation.supportOptions.find(({ name }) => name === "FAQs")?.href).toBe("/#faq");
	});
});
