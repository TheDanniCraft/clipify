"use server";

import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { editorsTable, plausibleStatsCacheTable, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { getFeatureAccess } from "@lib/featureAccess";
import { createCreatorAnalyticsCsv, fillEmptyCreatorAnalyticsRange, parsePlausibleCreatorAnalytics, recordCreatorAnalyticsMetric, type CreatorAnalyticsData, type CreatorAnalyticsExportDataset, type PlausibleCreatorPayload } from "@lib/plausibleCreatorAnalytics";
import { PLAUSIBLE_BASE_URL, PLAUSIBLE_SITE_ID } from "@lib/plausibleConfig";
import { and, eq, inArray } from "drizzle-orm";

const CACHE_TTL_MS = 10 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CreatorAnalyticsRange = { start: string; end: string };
export type CreatorAnalyticsExportTarget = { id: string; username: string; avatar: string; isSelf: boolean };

function normalizedRange(range?: CreatorAnalyticsRange | null): CreatorAnalyticsRange | null {
	if (!range || !ISO_DATE.test(range.start) || !ISO_DATE.test(range.end) || range.start > range.end) return null;
	const start = new Date(`${range.start}T00:00:00Z`);
	const end = new Date(`${range.end}T00:00:00Z`);
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
	const maximumRangeMs = 366 * 5 * 24 * 60 * 60 * 1000;
	return end.getTime() - start.getTime() <= maximumRangeMs ? range : null;
}

async function ownerForActor(actorId: string, ownerId: string) {
	if (actorId !== ownerId) {
		const editor = await db
			.select({ userId: editorsTable.userId })
			.from(editorsTable)
			.where(and(eq(editorsTable.userId, ownerId), eq(editorsTable.editorId, actorId)))
			.limit(1)
			.execute();
		if (!editor[0]) return null;
	}
	const owners = await db.select().from(usersTable).where(eq(usersTable.id, ownerId)).limit(1).execute();
	const owner = owners[0];
	if (!owner) return null;
	const ownerWithEntitlements = { ...owner, entitlements: await resolveUserEntitlements(owner) };
	return getFeatureAccess(ownerWithEntitlements, "creator_page_analytics").allowed ? ownerWithEntitlements : null;
}

async function loadCreatorAnalytics(owner: typeof usersTable.$inferSelect, range?: CreatorAnalyticsRange | null): Promise<(CreatorAnalyticsData & { stale: boolean; fetchedAt: string }) | null> {
	const validRange = normalizedRange(range);
	const dateRange: "30d" | [string, string] = validRange ? [validRange.start, validRange.end] : "30d";
	const cacheKey = validRange ? `creator-page:analytics:v5:${validRange.start}:${validRange.end}` : "creator-page:analytics:v5:30d";
	const legacyCacheKeys = validRange ? [`creator-page:analytics:v4:${validRange.start}:${validRange.end}`, `creator-page:analytics:v3:${validRange.start}:${validRange.end}`] : ["creator-page:analytics:v4:30d", "creator-page:analytics:v3:30d", "creator-page:analytics:v2:30d"];
	const readableCacheKeys = [cacheKey, ...legacyCacheKeys];
	const cacheRows = await db
		.select()
		.from(plausibleStatsCacheTable)
		.where(and(eq(plausibleStatsCacheTable.ownerId, owner.id), inArray(plausibleStatsCacheTable.cacheKey, readableCacheKeys)))
		.execute();
	const currentCached = cacheRows.find((row) => row.cacheKey === cacheKey);
	const cached = currentCached ?? legacyCacheKeys.map((key) => cacheRows.find((row) => row.cacheKey === key)).find(Boolean);
	const parseResult = (payload: PlausibleCreatorPayload, fetchedAt: Date, stale: boolean) => {
		const end = validRange?.end ?? fetchedAt.toISOString().slice(0, 10);
		const start = validRange?.start ?? new Date(new Date(`${end}T00:00:00Z`).getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
		return { ...fillEmptyCreatorAnalyticsRange(parsePlausibleCreatorAnalytics(payload), start, end), stale, fetchedAt: fetchedAt.toISOString() };
	};
	if (currentCached && currentCached.expiresAt.getTime() > Date.now()) {
		recordCreatorAnalyticsMetric("hits");
		return parseResult(JSON.parse(currentCached.value) as PlausibleCreatorPayload, currentCached.fetchedAt, false);
	}
	recordCreatorAnalyticsMetric("misses");
	const apiKey = process.env.PLAUSIBLE_API_KEY;
	if (!apiKey) {
		console.error("[creator-analytics] PLAUSIBLE_API_KEY is not configured", { ownerId: owner.id, cacheKey });
		return cached ? parseResult(JSON.parse(cached.value) as PlausibleCreatorPayload, cached.fetchedAt, true) : null;
	}
	try {
		const escapedUsername = owner.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const baseQuery = { site_id: PLAUSIBLE_SITE_ID, date_range: dateRange, filters: [["matches", "event:page", [`^/creators/${escapedUsername}/?$`]]] };
		const query = async (name: string, queryBody: Record<string, unknown>) => {
			const started = Date.now();
			const response = await fetch(`${PLAUSIBLE_BASE_URL}/api/v2/query`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...baseQuery, ...queryBody }), cache: "no-store" });
			recordCreatorAnalyticsMetric("apiRequests", Date.now() - started);
			if (!response.ok) {
				if (response.status === 429) recordCreatorAnalyticsMetric("rateLimited");
				const responseBody = (await response.text()).slice(0, 500);
				throw new Error(`Plausible ${name} query returned ${response.status}${responseBody ? `: ${responseBody}` : ""}`);
			}
			return response.json() as Promise<unknown>;
		};
		const playbackFilters = [...baseQuery.filters, ["is", "event:goal", ["Playback Start"]]];
		const [overview, timeseries, acquisition, locations, technology, playbackOverview, playbackTimeseries] = await Promise.all([
			query("overview", { metrics: ["visitors", "pageviews", "visits", "bounce_rate", "time_on_page", "scroll_depth"] }),
			query("timeseries", { metrics: ["visitors", "pageviews", "visits", "bounce_rate", "time_on_page", "scroll_depth"], dimensions: ["time:day"], include: { time_labels: true } }),
			query("acquisition", { metrics: ["visits"], dimensions: ["visit:source", "visit:channel", "visit:utm_source", "visit:utm_medium", "visit:utm_campaign"], pagination: { limit: 500 } }),
			query("locations", { metrics: ["visits"], dimensions: ["visit:country_name", "visit:region_name", "visit:city_name"], pagination: { limit: 500 } }),
			query("technology", { metrics: ["visits"], dimensions: ["visit:device", "visit:browser", "visit:os"], pagination: { limit: 500 } }),
			query("playback overview", { metrics: ["events", "visits"], filters: playbackFilters }),
			query("playback timeseries", { metrics: ["events", "visits"], filters: playbackFilters, dimensions: ["time:day"], include: { time_labels: true } }),
		]);
		const payload: PlausibleCreatorPayload = { overview, timeseries, acquisition, locations, technology, playbackOverview, playbackTimeseries };
		const fetchedAt = new Date();
		await db
			.insert(plausibleStatsCacheTable)
			.values({ ownerId: owner.id, cacheKey, value: JSON.stringify(payload), fetchedAt, expiresAt: new Date(fetchedAt.getTime() + CACHE_TTL_MS), lastErrorAt: null })
			.onConflictDoUpdate({ target: [plausibleStatsCacheTable.ownerId, plausibleStatsCacheTable.cacheKey], set: { value: JSON.stringify(payload), fetchedAt, expiresAt: new Date(fetchedAt.getTime() + CACHE_TTL_MS), lastErrorAt: null } })
			.execute();
		return parseResult(payload, fetchedAt, false);
	} catch (error) {
		recordCreatorAnalyticsMetric("apiFailures");
		console.error("[creator-analytics] failed to refresh Plausible cache", { ownerId: owner.id, cacheKey, error });
		if (!cached) return null;
		recordCreatorAnalyticsMetric("staleFallbacks");
		await db
			.update(plausibleStatsCacheTable)
			.set({ lastErrorAt: new Date() })
			.where(and(eq(plausibleStatsCacheTable.ownerId, owner.id), eq(plausibleStatsCacheTable.cacheKey, cached.cacheKey)))
			.execute();
		return parseResult(JSON.parse(cached.value) as PlausibleCreatorPayload, cached.fetchedAt, true);
	}
}

export async function getOwnCreatorAnalytics(range?: CreatorAnalyticsRange | null) {
	const user = await validateAuth();
	if (!user || !getFeatureAccess(user, "creator_page_analytics").allowed) return null;
	return loadCreatorAnalytics(user, range);
}

export async function getCreatorAnalyticsExportTargets(): Promise<CreatorAnalyticsExportTarget[]> {
	const actor = await validateAuth();
	if (!actor) return [];
	const editorRows = await db.select({ userId: editorsTable.userId }).from(editorsTable).where(eq(editorsTable.editorId, actor.id)).execute();
	const ownerIds = [...new Set(editorRows.map((row) => row.userId))];
	const managedOwners = ownerIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, ownerIds)).execute() : [];
	const eligibleManaged = [];
	for (const owner of managedOwners) {
		const entitlements = await resolveUserEntitlements(owner);
		if (getFeatureAccess({ ...owner, entitlements }, "creator_page_analytics").allowed) eligibleManaged.push({ id: owner.id, username: owner.username, avatar: owner.avatar, isSelf: false });
	}
	return [{ id: actor.id, username: actor.username, avatar: actor.avatar, isSelf: true }, ...eligibleManaged.sort((a, b) => a.username.localeCompare(b.username))];
}

export async function exportCreatorAnalytics(input: { ownerId: string; range?: CreatorAnalyticsRange | null; dataset: CreatorAnalyticsExportDataset }) {
	const actor = await validateAuth();
	if (!actor || !["daily", "acquisition", "locations", "technology"].includes(input.dataset)) return null;
	const owner = await ownerForActor(actor.id, input.ownerId);
	if (!owner) return null;
	const analytics = await loadCreatorAnalytics(owner, input.range);
	if (!analytics) return null;
	const range = normalizedRange(input.range);
	const rangeLabel = range ? `${range.start}_${range.end}` : "last-30-days";
	return {
		filename: `clipify-${owner.username}-${input.dataset}-${rangeLabel}.csv`.replace(/[^a-zA-Z0-9._-]/g, "-"),
		csv: createCreatorAnalyticsCsv(analytics, input.dataset),
	};
}
