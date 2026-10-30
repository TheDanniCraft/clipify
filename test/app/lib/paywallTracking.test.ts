import { trackPaywallEvent } from "@/app/lib/paywallTracking";
import { trackEvent } from "@/app/lib/analytics";
jest.mock("@/app/lib/analytics", () => ({ trackEvent: jest.fn() }));

it("preserves the existing aggregate paywall event and context through native tracking", () => {
	trackPaywallEvent("checkout_start", { source: "pricing", value: 1 });
	expect(trackEvent).toHaveBeenCalledWith("checkout_start", { source: "pricing", value: 1 });
});
