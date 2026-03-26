import { tiers, frequencies } from "@/app/components/Pricing/pricing-tiers";

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
});

