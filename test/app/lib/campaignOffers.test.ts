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

const getPocketBaseAuthToken = jest.fn();
const getPocketBaseUrl = jest.fn();
const invalidatePocketBaseAuthToken = jest.fn();

jest.mock("next/cache", () => ({
	unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("@lib/pocketbaseAuth", () => ({
	getPocketBaseAuthToken: (...args: unknown[]) => getPocketBaseAuthToken(...args),
	getPocketBaseUrl: (...args: unknown[]) => getPocketBaseUrl(...args),
	invalidatePocketBaseAuthToken: (...args: unknown[]) => invalidatePocketBaseAuthToken(...args),
}));

function makeListResponse(items: TestRecord[]) {
	return {
		items,
		page: 1,
		perPage: 200,
		totalItems: items.length,
		totalPages: 1,
	};
}

async function loadCampaignOffersModule() {
	jest.resetModules();
	return import("@/app/lib/campaignOffers");
}

describe("lib/campaignOffers selectActiveCampaignOffer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getPocketBaseUrl.mockReturnValue("https://pb.example.com");
	});

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

	it("returns the top active record even if it is incomplete", () => {
		const now = new Date("2026-04-02T12:00:00.000Z");
		const incomplete = makeRecord({ id: "incomplete", priority: 10, ctaHref: undefined });
		const valid = makeRecord({ id: "valid", priority: 5 });

		const selected = selectActiveCampaignOffer([valid, incomplete], now);
		expect(selected?.id).toBe("incomplete");
	});

	it("fetches the campaign_offers collection with auth headers and maps the winning offer", async () => {
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () =>
				makeListResponse([
					makeRecord({
						id: "winner",
						slug: "spring-launch",
						icon: "offer.png",
						floatingCtaLabel: "Claim Now",
						showPricingTierPromo: true,
						pricingMonthlyPromo: 1,
						pricingYearlyPromo: 10,
						updated: "2026-04-02T00:00:00.000Z",
					} as Partial<TestRecord> & { icon: string }),
				]),
		});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
		const parsed = new URL(requestUrl);
		expect(parsed.origin).toBe("https://pb.example.com");
		expect(parsed.pathname).toBe("/api/collections/campaign_offers/records");
		expect(parsed.searchParams.get("page")).toBe("1");
		expect(parsed.searchParams.get("perPage")).toBe("200");
		expect(parsed.searchParams.get("sort")).toBe("-priority");
		expect(parsed.searchParams.get("filter")).toBe("isEnabled = true && startAt <= @now && (endAt = null || endAt > @now)");
		expect(requestInit.headers).toEqual(
			expect.objectContaining({
				Authorization: "Bearer pb-token",
			}),
		);
		expect(offer).toEqual(
			expect.objectContaining({
				id: "winner",
				slug: "spring-launch",
				utmCampaign: "spring-launch",
				floatingCtaLabel: "Claim Now",
				showPricingTierPromo: true,
				pricingMonthlyPromo: 1,
				pricingYearlyPromo: 10,
				iconUrl: "https://pb.example.com/api/files/c1/winner/offer.png",
			}),
		);
	});

	it("invalidates auth and retries once on 401 responses", async () => {
		getPocketBaseAuthToken.mockResolvedValueOnce("stale-token").mockResolvedValueOnce("fresh-token");
		const fetchMock = jest
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeListResponse([makeRecord({ id: "retried", utmCampaign: "launch-utm" })]),
			});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(invalidatePocketBaseAuthToken).toHaveBeenCalledTimes(1);
		expect(getPocketBaseAuthToken).toHaveBeenNthCalledWith(1);
		expect(getPocketBaseAuthToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers).toEqual(
			expect.objectContaining({
				Authorization: "Bearer fresh-token",
			}),
		);
		expect(offer).toEqual(expect.objectContaining({ id: "retried", utmCampaign: "launch-utm" }));
	});

	it("retries without the API filter when PocketBase rejects the filtered query", async () => {
		const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Failed to parse filter expression near "isEnabled"',
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeListResponse([makeRecord({ id: "fallback-record", slug: "fallback-record" })]),
			});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [firstUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
		const [secondUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(new URL(firstUrl).searchParams.get("filter")).toBe("isEnabled = true && startAt <= @now && (endAt = null || endAt > @now)");
		expect(new URL(secondUrl).searchParams.get("filter")).toBeNull();
		expect(consoleWarn).toHaveBeenCalledWith(
			"[campaign_offers] filtered fetch rejected; retrying without filter",
			expect.objectContaining({
				status: 400,
				error: 'Failed to parse filter expression near "isEnabled"',
			}),
		);
		expect(offer).toEqual(expect.objectContaining({ id: "fallback-record" }));

		consoleWarn.mockRestore();
	});

	it("retries without sort when PocketBase rejects the unfiltered sorted query", async () => {
		const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Bad filter',
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Bad sort',
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => makeListResponse([makeRecord({ id: "plain-record", slug: "plain-record" })]),
			});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(new URL((fetchMock.mock.calls[0] as [string, RequestInit])[0]).searchParams.get("filter")).toBe("isEnabled = true && startAt <= @now && (endAt = null || endAt > @now)");
		expect(new URL((fetchMock.mock.calls[1] as [string, RequestInit])[0]).searchParams.get("filter")).toBeNull();
		expect(new URL((fetchMock.mock.calls[1] as [string, RequestInit])[0]).searchParams.get("sort")).toBe("-priority");
		expect(new URL((fetchMock.mock.calls[2] as [string, RequestInit])[0]).searchParams.get("filter")).toBeNull();
		expect(new URL((fetchMock.mock.calls[2] as [string, RequestInit])[0]).searchParams.get("sort")).toBeNull();
		expect(consoleWarn).toHaveBeenCalledWith(
			"[campaign_offers] unfiltered fetch rejected; retrying without sort",
			expect.objectContaining({
				status: 400,
				error: "Bad sort",
				sort: "-priority",
			}),
		);
		expect(offer).toEqual(expect.objectContaining({ id: "plain-record" }));

		consoleWarn.mockRestore();
	});

	it("falls back to the next valid active campaign when the top record is incomplete", async () => {
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () =>
				makeListResponse([
					makeRecord({ id: "broken-top", priority: 10, ctaHref: undefined }),
					makeRecord({ id: "valid-fallback", priority: 5, slug: "fallback-offer" }),
				]),
		});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(offer).toEqual(
			expect.objectContaining({
				id: "valid-fallback",
				slug: "fallback-offer",
			}),
		);
	});

	it("maps an active campaign when name is missing", async () => {
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () =>
				makeListResponse([
					makeRecord({
						id: "title-only",
						name: undefined,
						title: "Spring promo",
						slug: "spring-promo",
					}),
				]),
		});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(offer).toEqual(
			expect.objectContaining({
				id: "title-only",
				name: "Spring promo",
				slug: "spring-promo",
			}),
		);
	});

	it("parses numeric promo values from PocketBase text fields", async () => {
		getPocketBaseAuthToken.mockResolvedValue("pb-token");
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () =>
				makeListResponse([
					makeRecord({
						id: "promo-text",
						pricingMonthlyPromo: "1" as unknown as number,
						pricingYearlyPromo: "10" as unknown as number,
						showPricingTierPromo: true,
					}),
				]),
		});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await loadCampaignOffersModule();
		const offer = await mod.getActiveCampaignOffer();

		expect(offer).toEqual(
			expect.objectContaining({
				id: "promo-text",
				pricingMonthlyPromo: 1,
				pricingYearlyPromo: 10,
			}),
		);
	});

	it("returns null when PocketBase auth or fetch throws", async () => {
		const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
		getPocketBaseAuthToken.mockRejectedValue(new Error("network down"));

		const mod = await loadCampaignOffersModule();
		await expect(mod.getActiveCampaignOffer()).resolves.toBeNull();
		expect(consoleWarn).toHaveBeenCalledWith(
			"[campaign_offers] failed to load records",
			expect.objectContaining({ error: "network down" }),
		);

		consoleWarn.mockRestore();
	});
});

