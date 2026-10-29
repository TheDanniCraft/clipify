import { pricingFeatures, runnerIncluded } from "@/app/components/Pricing/pricing-catalog";
import { tiers, frequencies } from "@/app/components/Pricing/pricing-tiers";
import { resolveRuntimePricing } from "@/app/components/Pricing/pricing-types";

describe("components/Pricing/pricing-tiers", () => {
	it("includes MCP access on Free and Pro under the same backend plan limits", () => {
		const feature = pricingFeatures.flatMap((section) => section.items).find((item) => item.title === "AI assistant access (MCP)");
		expect(feature?.tiers).toEqual({ free: true, pro: true });
		expect(feature?.helpText).toMatch(/plan limits/i);
		expect(tiers.find((tier) => tier.key === "free")?.features).toContain("AI assistant access (MCP)");
	});
	it("includes playlist limits on free and unlimited playlist features on pro", () => {
		const free = tiers.find((tier) => tier.key === "free");
		const pro = tiers.find((tier) => tier.key === "pro");

		expect(free?.features).toEqual(expect.arrayContaining(["One playlist (up to 50 clips)", "Playlist overlay type"]));
		expect(pro?.features).toEqual(expect.arrayContaining(["Unlimited playlists and playlist clips", "Playlist imports with advanced filters"]));
	});

	it("keeps monthly and yearly billing frequencies", () => {
		expect(frequencies.map((frequency) => frequency.key)).toEqual(["yearly", "monthly"]);
	});

	it("keeps landing-page summaries concise while preserving the full catalog", () => {
		expect(tiers.every((tier) => (tier.summaryFeatures?.length ?? 0) <= 6)).toBe(true);
		expect(tiers.find((tier) => tier.key === "pro")?.personalNote).toMatch(/independent developer/i);
		expect(pricingFeatures.flatMap((group) => group.items).find((feature) => feature.title === "Analytics CSV export")?.tiers).toEqual({ free: false, pro: true });
	});

	it("models Runner as included with no separate public purchase prices", () => {
		expect(runnerIncluded.availability).toBe("Included with Free and Pro");
		expect(runnerIncluded).not.toHaveProperty("prices");
	});

	it("provides an explanation for every comparison feature", () => {
		expect(pricingFeatures.flatMap((group) => group.items).every((feature) => Boolean(feature.helpText?.trim()))).toBe(true);
	});

	it("keeps pricing renderable when the runtime catalog is missing", () => {
		const pricing = resolveRuntimePricing(undefined);
		expect(pricing.pro.yearly).toEqual({ amount: null, currency: "EUR", formatted: "Unavailable" });
		expect(pricing).not.toHaveProperty("runner");
	});
});

it("calculates annual savings only from comparable resolved prices", async () => {
	const { annualSavingsPercent } = await import("@/app/components/Pricing/pricing-types");
	const pricing = { pro: { monthly: { amount: 2, currency: "EUR", formatted: "€2" }, yearly: { amount: 20, currency: "EUR", formatted: "€20" } } };
	expect(annualSavingsPercent(pricing)).toBe(16);
	expect(annualSavingsPercent()).toBeNull();
	for (const yearly of [
		{ amount: null, currency: "EUR", formatted: "" },
		{ amount: 20, currency: "USD", formatted: "" },
		{ amount: 24, currency: "EUR", formatted: "" },
		{ amount: -1, currency: "EUR", formatted: "" },
	])
		expect(annualSavingsPercent({ pro: { ...pricing.pro, yearly } })).toBeNull();
	expect(annualSavingsPercent({ pro: { ...pricing.pro, monthly: { ...pricing.pro.monthly, amount: 0 } } })).toBeNull();
});

it("describes the exact annual saving in free months without promising rounded-up months", async () => {
	const { annualSavingsLabel } = await import("@/app/components/Pricing/pricing-types");
	const pricing = { pro: { monthly: { amount: 2, currency: "EUR", formatted: "€2" }, yearly: { amount: 20, currency: "EUR", formatted: "€20" } } };
	expect(annualSavingsLabel(pricing)).toBe("2 months free");
	expect(annualSavingsLabel({ pro: { ...pricing.pro, yearly: { ...pricing.pro.yearly, amount: 22 } } })).toBe("1 month free");
	expect(annualSavingsLabel({ pro: { ...pricing.pro, yearly: { ...pricing.pro.yearly, amount: 21 } } })).toBe("Save 12%");
	expect(annualSavingsLabel()).toBeNull();
});
