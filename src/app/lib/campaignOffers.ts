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
	showPricingCard?: boolean;
	title?: string;
	subtitle?: string | null;
	badgeText?: string | null;
	ctaLabel?: string;
	ctaHref?: string;
	offerCode?: string | null;
	utmCampaign?: string | null;
	icon?: string;
	updated?: string;
};

const COLLECTION_NAME = "campain_offfers";
const CACHE_TTL_SECONDS = 60;

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

export function selectActiveCampaignOffer(records: PocketBaseCampaignOfferRecord[], now = new Date()): PocketBaseCampaignOfferRecord | null {
	const active = records.filter((record) => isRecordActive(record, now));
	if (active.length === 0) return null;

	active.sort((a, b) => {
		const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
		if (priorityDiff !== 0) return priorityDiff;
		return toTime(b.updated) - toTime(a.updated);
	});

	return active[0] ?? null;
}

function mapRecordToOffer(baseUrl: string, record: PocketBaseCampaignOfferRecord): CampaignOffer | null {
	if (!record.name || !record.slug || !record.startAt || !record.title || !record.ctaLabel || !record.ctaHref) {
		return null;
	}

	const iconUrl = record.icon ? `${baseUrl}/api/files/${record.collectionId}/${record.id}/${record.icon}` : null;

	return {
		id: record.id,
		name: record.name,
		slug: record.slug,
		isEnabled: Boolean(record.isEnabled),
		startAt: record.startAt,
		endAt: record.endAt ?? null,
		priority: record.priority ?? 0,
		showFloatingBanner: record.showFloatingBanner ?? true,
		showPricingCard: record.showPricingCard ?? true,
		title: record.title,
		subtitle: record.subtitle ?? null,
		badgeText: record.badgeText ?? null,
		ctaLabel: record.ctaLabel,
		ctaHref: record.ctaHref,
		offerCode: record.offerCode ?? null,
		utmCampaign: record.utmCampaign?.trim() || record.slug,
		iconUrl,
		updated: record.updated ?? null,
	};
}

async function fetchCampaignOffersFromPocketBase(): Promise<CampaignOffer | null> {
	const pocketBaseUrl = getPocketBaseUrl();
	if (!pocketBaseUrl) return null;

	const now = new Date();
	const requestUrl = new URL(`/api/collections/${COLLECTION_NAME}/records`, pocketBaseUrl);
	requestUrl.searchParams.set("page", "1");
	requestUrl.searchParams.set("perPage", "200");
	requestUrl.searchParams.set("sort", "-priority,-updated");

	const authToken = await getPocketBaseAuthToken();
	if (!authToken) return null;

	const response = await fetch(requestUrl.toString(), {
		method: "GET",
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
		next: { revalidate: CACHE_TTL_SECONDS },
	});

	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			invalidatePocketBaseAuthToken();
			const retryToken = await getPocketBaseAuthToken({ forceRefresh: true });
			if (retryToken) {
				const retryResponse = await fetch(requestUrl.toString(), {
					method: "GET",
					headers: {
						Authorization: `Bearer ${retryToken}`,
					},
					next: { revalidate: CACHE_TTL_SECONDS },
				});
				if (retryResponse.ok) {
					const retryPayload = (await retryResponse.json()) as PocketBaseListResponse<PocketBaseCampaignOfferRecord>;
					const retryWinner = selectActiveCampaignOffer(retryPayload.items ?? [], now);
					if (!retryWinner) return null;
					return mapRecordToOffer(pocketBaseUrl, retryWinner);
				}
			}
		}
		console.warn("[campaign_offers] failed to fetch records", { status: response.status });
		return null;
	}

	const payload = (await response.json()) as PocketBaseListResponse<PocketBaseCampaignOfferRecord>;
	const winningRecord = selectActiveCampaignOffer(payload.items ?? [], now);
	if (!winningRecord) return null;

	return mapRecordToOffer(pocketBaseUrl, winningRecord);
}

const getCachedActiveCampaignOffer = unstable_cache(async () => fetchCampaignOffersFromPocketBase(), ["campaign-offers-active"], {
	revalidate: CACHE_TTL_SECONDS,
});

export async function getActiveCampaignOffer(): Promise<CampaignOffer | null> {
	return getCachedActiveCampaignOffer();
}
