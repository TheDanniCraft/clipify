import "server-only";

import { unstable_cache } from "next/cache";
import type { CampaignOffer } from "@types";
import { getPocketBaseAuthToken, getPocketBaseUrl, invalidatePocketBaseAuthToken } from "@lib/pocketbaseAuth";

type PocketBaseListResponse<T> = {
	items: T[];
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
};

type PocketBaseCampaignOfferRecord = {
	id: string;
	collectionId: string;
	name?: string;
	slug?: string;
	isEnabled?: boolean;
	startAt?: string;
	endAt?: string | null;
	priority?: number;
	showFloatingBanner?: boolean;
	showDashboardBanner?: boolean;
	showPricingCard?: boolean;
	title?: string;
	subtitle?: string | null;
	badgeText?: string | null;
	floatingTitle?: string | null;
	floatingSubtitle?: string | null;
	ctaLabel?: string;
	floatingCtaLabel?: string | null;
	ctaHref?: string;
	offerCode?: string | null;
	utmCampaign?: string | null;
	autoApplyAtCheckout?: boolean;
	showPricingTierPromo?: boolean;
	pricingMonthlyPromo?: number | null;
	pricingYearlyPromo?: number | null;
	icon?: string;
	updated?: string;
};

const COLLECTION_NAME = "campaign_offers";
const CACHE_TTL_SECONDS = 60;
const ACTIVE_CAMPAIGN_FILTER = "isEnabled = true && startAt <= @now && (endAt = null || endAt > @now)";
const CAMPAIGN_SORT = "-priority";

type FetchCampaignRecordsResult = {
	response: Response;
	requestUrl: URL;
};

function isRecordActive(record: PocketBaseCampaignOfferRecord, now: Date): boolean {
	if (!record.isEnabled || !record.startAt) return false;
	const startAt = new Date(record.startAt);
	if (Number.isNaN(startAt.getTime())) return false;
	if (startAt.getTime() > now.getTime()) return false;
	if (!record.endAt) return true;
	const endAt = new Date(record.endAt);
	if (Number.isNaN(endAt.getTime())) return false;
	return endAt.getTime() > now.getTime();
}

function toTime(value: string | undefined | null): number {
	if (!value) return 0;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toOptionalInt(value: number | string | null | undefined): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.trunc(value);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) return Math.trunc(parsed);
	}
	return null;
}

function sortCampaignOffers(records: PocketBaseCampaignOfferRecord[]): PocketBaseCampaignOfferRecord[] {
	return [...records].sort((a, b) => {
		const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
		if (priorityDiff !== 0) return priorityDiff;
		return toTime(b.updated) - toTime(a.updated);
	});
}

export function selectActiveCampaignOffer(records: PocketBaseCampaignOfferRecord[], now = new Date()): PocketBaseCampaignOfferRecord | null {
	const active = records.filter((record) => isRecordActive(record, now));
	if (active.length === 0) return null;

	return sortCampaignOffers(active)[0] ?? null;
}

function mapRecordToOffer(baseUrl: string, record: PocketBaseCampaignOfferRecord): CampaignOffer | null {
	if (!record.slug || !record.startAt || !record.title || !record.ctaLabel || !record.ctaHref) {
		return null;
	}

	const iconUrl = record.icon ? `${baseUrl}/api/files/${record.collectionId}/${record.id}/${record.icon}` : null;
	const name = record.name?.trim() || record.title.trim() || record.slug.trim();

	return {
		id: record.id,
		name,
		slug: record.slug,
		isEnabled: Boolean(record.isEnabled),
		startAt: record.startAt,
		endAt: record.endAt ?? null,
		priority: record.priority ?? 0,
		showFloatingBanner: record.showFloatingBanner ?? true,
		showDashboardBanner: record.showDashboardBanner ?? true,
		showPricingCard: record.showPricingCard ?? true,
		title: record.title,
		subtitle: record.subtitle ?? null,
		badgeText: record.badgeText ?? null,
		floatingTitle: record.floatingTitle?.trim() || null,
		floatingSubtitle: record.floatingSubtitle?.trim() || null,
		ctaLabel: record.ctaLabel,
		floatingCtaLabel: record.floatingCtaLabel?.trim() || null,
		ctaHref: record.ctaHref,
		offerCode: record.offerCode ?? null,
		utmCampaign: record.utmCampaign?.trim() || record.slug,
		autoApplyAtCheckout: record.autoApplyAtCheckout ?? true,
		showPricingTierPromo: record.showPricingTierPromo ?? false,
		pricingMonthlyPromo: toOptionalInt(record.pricingMonthlyPromo),
		pricingYearlyPromo: toOptionalInt(record.pricingYearlyPromo),
		iconUrl,
		updated: record.updated ?? null,
	};
}

function selectMappableCampaignOffer(baseUrl: string, records: PocketBaseCampaignOfferRecord[], now: Date): CampaignOffer | null {
	const active = records.filter((record) => isRecordActive(record, now));

	for (const record of sortCampaignOffers(active)) {
		const offer = mapRecordToOffer(baseUrl, record);
		if (offer) return offer;
	}

	return null;
}

function buildCampaignOffersRequestUrl(pocketBaseUrl: string, options?: { includeFilter?: boolean; includeSort?: boolean }): URL {
	const requestUrl = new URL(`/api/collections/${COLLECTION_NAME}/records`, pocketBaseUrl);
	requestUrl.searchParams.set("page", "1");
	requestUrl.searchParams.set("perPage", "200");
	if (options?.includeSort ?? true) {
		requestUrl.searchParams.set("sort", CAMPAIGN_SORT);
	}
	if (options?.includeFilter ?? true) {
		requestUrl.searchParams.set("filter", ACTIVE_CAMPAIGN_FILTER);
	}
	return requestUrl;
}

async function fetchCampaignOfferRecords(requestUrl: URL, authToken: string): Promise<Response> {
	return fetch(requestUrl.toString(), {
		method: "GET",
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
		next: { revalidate: CACHE_TTL_SECONDS },
	});
}

async function fetchCampaignOfferRecordsWithFallback(pocketBaseUrl: string, authToken: string): Promise<FetchCampaignRecordsResult> {
	const filteredRequestUrl = buildCampaignOffersRequestUrl(pocketBaseUrl, { includeFilter: true, includeSort: true });
	const filteredResponse = await fetchCampaignOfferRecords(filteredRequestUrl, authToken);
	if (filteredResponse.status !== 400) {
		return { response: filteredResponse, requestUrl: filteredRequestUrl };
	}

	const errorText = await filteredResponse.text();
	console.warn("[campaign_offers] filtered fetch rejected; retrying without filter", {
		status: filteredResponse.status,
		error: errorText,
		filter: ACTIVE_CAMPAIGN_FILTER,
	});

	const unfilteredRequestUrl = buildCampaignOffersRequestUrl(pocketBaseUrl, { includeFilter: false, includeSort: true });
	const unfilteredResponse = await fetchCampaignOfferRecords(unfilteredRequestUrl, authToken);
	if (unfilteredResponse.status !== 400) {
		return { response: unfilteredResponse, requestUrl: unfilteredRequestUrl };
	}

	const unfilteredErrorText = await unfilteredResponse.text();
	console.warn("[campaign_offers] unfiltered fetch rejected; retrying without sort", {
		status: unfilteredResponse.status,
		error: unfilteredErrorText,
		sort: CAMPAIGN_SORT,
	});

	const unsortedRequestUrl = buildCampaignOffersRequestUrl(pocketBaseUrl, { includeFilter: false, includeSort: false });
	const unsortedResponse = await fetchCampaignOfferRecords(unsortedRequestUrl, authToken);
	return { response: unsortedResponse, requestUrl: unsortedRequestUrl };
}

async function fetchCampaignOffersFromPocketBase(): Promise<CampaignOffer | null> {
	const pocketBaseUrl = getPocketBaseUrl();
	if (!pocketBaseUrl) return null;

	try {
		const now = new Date();
		const authToken = await getPocketBaseAuthToken();
		if (!authToken) return null;

		const { response, requestUrl } = await fetchCampaignOfferRecordsWithFallback(pocketBaseUrl, authToken);

		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				invalidatePocketBaseAuthToken();
				const retryToken = await getPocketBaseAuthToken({ forceRefresh: true });
				if (retryToken) {
					const { response: retryResponse } = await fetchCampaignOfferRecordsWithFallback(pocketBaseUrl, retryToken);
					if (retryResponse.ok) {
						const retryPayload = (await retryResponse.json()) as PocketBaseListResponse<PocketBaseCampaignOfferRecord>;
						return selectMappableCampaignOffer(pocketBaseUrl, retryPayload.items ?? [], now);
					}
				}
			}

			const errorText = await response.text();
			console.warn("[campaign_offers] failed to fetch records", { status: response.status, error: errorText, url: requestUrl.toString() });
			return null;
		}

		const payload = (await response.json()) as PocketBaseListResponse<PocketBaseCampaignOfferRecord>;
		return selectMappableCampaignOffer(pocketBaseUrl, payload.items ?? [], now);
	} catch (error) {
		console.warn("[campaign_offers] failed to load records", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

const getCachedActiveCampaignOffer = unstable_cache(async () => fetchCampaignOffersFromPocketBase(), ["campaign-offers-active"], {
	revalidate: CACHE_TTL_SECONDS,
});

export async function getActiveCampaignOffer(): Promise<CampaignOffer | null> {
	return getCachedActiveCampaignOffer();
}
