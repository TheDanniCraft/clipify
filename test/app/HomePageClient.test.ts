/** @jest-environment jsdom */
export {};

jest.mock("@c15t/nextjs/components/consent-dialog-link", () => ({ ConsentDialogLink: () => null }));

import { buildCampaignOfferHref } from "@/app/HomePageClient";

describe("HomePageClient buildCampaignOfferHref", () => {
	it("preserves absolute redeem origins when adding the campaign param", () => {
		expect(buildCampaignOfferHref("https://preview.clipify.us/redeem?code=SPRING", "launch_offer")).toBe("https://preview.clipify.us/redeem?code=SPRING&campaign=launch_offer");
	});

	it("keeps relative redeem URLs relative when adding the campaign param", () => {
		expect(buildCampaignOfferHref("/redeem?code=SPRING", "launch_offer")).toBe("/redeem?code=SPRING&campaign=launch_offer");
	});
});
