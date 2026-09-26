import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN, chatwootConsentScript } from "@/app/lib/consent/chatwoot";

describe("Chatwoot consent script", () => {
	it("is functionality-gated and initializes the SDK after loading", () => {
		const run = jest.fn();
		window.chatwootSDK = { run };

		chatwootConsentScript.onBeforeLoad?.({} as never);
		chatwootConsentScript.onLoad?.({} as never);

		expect(chatwootConsentScript.category).toBe("functionality");
		expect(chatwootConsentScript.src).toBe(`${CHATWOOT_BASE_URL}/packs/js/sdk.js`);
		expect(window.chatwootSettings).toEqual(expect.objectContaining({ hideMessageBubble: false, position: "left" }));
		expect(run).toHaveBeenCalledWith({ websiteToken: CHATWOOT_WEBSITE_TOKEN, baseUrl: CHATWOOT_BASE_URL });
	});
});
