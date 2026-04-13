import "server-only";

import { unstable_cache } from "next/cache";
import { getPocketBaseAuthToken, getPocketBaseUrl, invalidatePocketBaseAuthToken } from "@lib/pocketbaseAuth";
import { normalizeRoadmapColor, normalizeRoadmapStatus, type RoadmapItemData } from "@components/roadmap/roadmapData";

type PocketBaseRoadmapRecord = {
	id: string;
	title?: string;
	description?: string;
	status?: string;
	icon?: string;
	color?: string;
	timeframe?: string;
	features1?: string | null;
	features2?: string | null;
	features3?: string | null;
	features4?: string | null;
	sortOrder?: number | null;
	created?: string;
};

type PocketBaseListResponse<T> = {
	items: T[];
};

type FetchRoadmapRecordsResult = {
	response: Response;
	requestUrl: URL;
};

const CACHE_TTL_SECONDS = 60;

function normalizeIcon(value?: string | null): string {
	const trimmed = value?.trim();
	return trimmed && trimmed.startsWith("Icon") ? trimmed : "IconBolt";
}

function mapRecord(record: PocketBaseRoadmapRecord): RoadmapItemData | null {
	const title = record.title?.trim();
	const description = record.description?.trim();
	const timeframe = record.timeframe?.trim();
	if (!title || !description || !timeframe) return null;

	return {
		icon: normalizeIcon(record.icon),
		color: normalizeRoadmapColor(record.color),
		title,
		description,
		status: normalizeRoadmapStatus(record.status),
		timeframe,
		features: [record.features1, record.features2, record.features3, record.features4].map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
	};
}

function toTime(value?: string | null): number {
	if (!value) return 0;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortRoadmapRecords(records: PocketBaseRoadmapRecord[]): PocketBaseRoadmapRecord[] {
	return [...records].sort((a, b) => {
		const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
		if (orderDiff !== 0) return orderDiff;
		return toTime(a.created) - toTime(b.created);
	});
}

function buildRoadmapRequestUrl(pocketBaseUrl: string, options?: { includeSort?: boolean }): URL {
	const requestUrl = new URL("/api/collections/roadmap/records", pocketBaseUrl);
	requestUrl.searchParams.set("page", "1");
	requestUrl.searchParams.set("perPage", "200");
	if (options?.includeSort ?? true) {
		requestUrl.searchParams.set("sort", "+sortOrder,+created");
	}
	return requestUrl;
}

async function fetchRoadmapRecords(requestUrl: URL, authToken: string): Promise<Response> {
	return fetch(requestUrl.toString(), {
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
		next: { revalidate: CACHE_TTL_SECONDS },
	});
}

async function fetchRoadmapRecordsWithFallback(pocketBaseUrl: string, authToken: string): Promise<FetchRoadmapRecordsResult> {
	const sortedRequestUrl = buildRoadmapRequestUrl(pocketBaseUrl, { includeSort: true });
	const sortedResponse = await fetchRoadmapRecords(sortedRequestUrl, authToken);
	if (sortedResponse.status !== 400) {
		return { response: sortedResponse, requestUrl: sortedRequestUrl };
	}

	const unsortedRequestUrl = buildRoadmapRequestUrl(pocketBaseUrl, { includeSort: false });
	const unsortedResponse = await fetchRoadmapRecords(unsortedRequestUrl, authToken);
	return { response: unsortedResponse, requestUrl: unsortedRequestUrl };
}

async function fetchRoadmapItemsFromPocketBase(): Promise<RoadmapItemData[]> {
	const pocketBaseUrl = getPocketBaseUrl();
	if (!pocketBaseUrl) return [];

	try {
		let authToken = await getPocketBaseAuthToken();
		if (!authToken) return [];

		let { response, requestUrl } = await fetchRoadmapRecordsWithFallback(pocketBaseUrl, authToken);

		if ((response.status === 401 || response.status === 403) && authToken) {
			invalidatePocketBaseAuthToken();
			authToken = await getPocketBaseAuthToken({ forceRefresh: true });
			if (authToken) {
				({ response, requestUrl } = await fetchRoadmapRecordsWithFallback(pocketBaseUrl, authToken));
			}
		}

		if (!response.ok) {
			const errorText = await response.text();
			console.warn("[roadmap] failed to fetch cms roadmap", { status: response.status, error: errorText, url: requestUrl.toString() });
			return [];
		}

		const payload = (await response.json()) as PocketBaseListResponse<PocketBaseRoadmapRecord>;
		return sortRoadmapRecords(payload.items ?? []).map(mapRecord).filter((item): item is RoadmapItemData => Boolean(item));
	} catch (error) {
		console.warn("[roadmap] failed to load cms roadmap", {
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

const getCachedRoadmapItems = unstable_cache(async () => fetchRoadmapItemsFromPocketBase(), ["roadmap-items"], {
	revalidate: CACHE_TTL_SECONDS,
});

export async function getRoadmapItems(): Promise<RoadmapItemData[]> {
	return getCachedRoadmapItems();
}
