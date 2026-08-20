import { pricingFeatures, runnerAddon } from "@/app/components/Pricing/pricing-catalog";
import { tiers, frequencies } from "@/app/components/Pricing/pricing-tiers";
import { resolveRuntimePricing } from "@/app/components/Pricing/pricing-types";

describe("components/Pricing/pricing-tiers", () => {
	it("includes playlist limits on free and unlimited playlist features on pro", () => {
		const free = tiers.find((tier) => tier.key === "free");
		const pro = tiers.find((tier) => tier.key === "pro");

		expect(free?.features).toEqual(expect.arrayContaining(["One playlist (up to 50 clips)", "Playlist overlay type"]));
		expect(pro?.features).toEqual(expect.arrayContaining(["Unlimited playlists and playlist clips", "Auto import playlists with advanced filters"]));
	});

	it("keeps monthly and yearly billing frequencies", () => {
		expect(frequencies.map((frequency) => frequency.key)).toEqual(["yearly", "monthly"]);
	});

	it("keeps landing-page summaries concise while preserving the full catalog", () => {
		expect(tiers.every((tier) => (tier.summaryFeatures?.length ?? 0) <= 6)).toBe(true);
		expect(tiers.find((tier) => tier.key === "pro")?.personalNote).toMatch(/independent developer/i);
		expect(pricingFeatures.flatMap((group) => group.items).find((feature) => feature.title === "Analytics CSV export")?.tiers).toEqual({ free: false, pro: true });
	});

	it("models the Runner as an add-on available to both plans", () => {
		expect(runnerAddon.availability).toBe("Available with Free or Pro");
		expect(runnerAddon.prices).toEqual({ monthly: "Unavailable", yearly: "Unavailable" });
	});

	it("provides an explanation for every comparison feature", () => {
		expect(pricingFeatures.flatMap((group) => group.items).every((feature) => Boolean(feature.helpText?.trim()))).toBe(true);
	});

	it("keeps pricing renderable when the runtime catalog is missing", () => {
		const pricing = resolveRuntimePricing(undefined);
		expect(pricing.pro.yearly).toEqual({ amount: null, currency: "EUR", formatted: "Unavailable" });
		expect(pricing.runner.monthly).toEqual({ amount: null, currency: "EUR", formatted: "Unavailable" });
	});
});
