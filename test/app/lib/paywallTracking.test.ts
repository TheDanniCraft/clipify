import { trackPaywallEvent } from "@/app/lib/paywallTracking";

describe("lib/paywallTracking", () => {
	it("forwards event name and props to plausible", () => {
		const plausible = jest.fn();

		trackPaywallEvent(plausible, "checkout_start", { source: "pricing", value: 1 });

		expect(plausible).toHaveBeenCalledWith("checkout_start", { props: { source: "pricing", value: 1 } });
	});

	it("forwards undefined props shape when omitted", () => {
		const plausible = jest.fn();
		trackPaywallEvent(plausible, "paywall_impression");
		expect(plausible).toHaveBeenCalledWith("paywall_impression", { props: undefined });
	});
});
