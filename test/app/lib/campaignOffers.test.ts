/** @jest-environment node */
export {};

import { selectActiveCampaignOffer } from "@/app/lib/campaignOffers";

type TestRecord = Parameters<typeof selectActiveCampaignOffer>[0][number];

function makeRecord(overrides: Partial<TestRecord>): TestRecord {
	return {
		id: "1",
		collectionId: "c1",
		name: "Offer",
		slug: "offer",
		isEnabled: true,
		startAt: "2026-01-01T00:00:00.000Z",
		endAt: null,
		priority: 0,
		showFloatingBanner: true,
		showPricingCard: true,
		title: "Offer title",
		ctaLabel: "Claim",
		ctaHref: "/redeem",
		updated: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("lib/campaignOffers selectActiveCampaignOffer", () => {
	it("picks the highest-priority active campaign", () => {
		const now = new Date("2026-04-02T12:00:00.000Z");
		const low = makeRecord({ id: "low", priority: 1 });
		const high = makeRecord({ id: "high", priority: 10 });

		const selected = selectActiveCampaignOffer([low, high], now);
		expect(selected?.id).toBe("high");
	});

	it("ignores disabled, future, and expired campaigns", () => {
		const now = new Date("2026-04-02T12:00:00.000Z");
		const disabled = makeRecord({ id: "disabled", isEnabled: false, priority: 100 });
		const future = makeRecord({ id: "future", startAt: "2026-06-01T00:00:00.000Z", priority: 99 });
		const expired = makeRecord({ id: "expired", endAt: "2026-03-01T00:00:00.000Z", priority: 98 });
		const active = makeRecord({ id: "active", priority: 1 });

		const selected = selectActiveCampaignOffer([disabled, future, expired, active], now);
		expect(selected?.id).toBe("active");
	});

	it("uses most-recent updated as tie-breaker", () => {
		const now = new Date("2026-04-02T12:00:00.000Z");
		const older = makeRecord({ id: "older", priority: 5, updated: "2026-03-01T00:00:00.000Z" });
		const newer = makeRecord({ id: "newer", priority: 5, updated: "2026-03-02T00:00:00.000Z" });

		const selected = selectActiveCampaignOffer([older, newer], now);
		expect(selected?.id).toBe("newer");
	});
});

