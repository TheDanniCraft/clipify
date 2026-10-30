"use server";

import { umamiWebsiteId } from "@/server/umami";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { db } from "@/db/client";
import { plausibleStatsCacheTable, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { getFeatureAccess } from "@lib/featureAccess";
import { createCreatorAnalyticsCsv, fillEmptyCreatorAnalyticsRange, recordCreatorAnalyticsMetric, type CreatorAnalyticsData, type CreatorAnalyticsExportDataset } from "@lib/plausibleCreatorAnalytics";
import { getUmamiCreatorAnalytics } from "@/server/umami-creator-analytics";
import { and, eq } from "drizzle-orm";
import { authorizeCreatorOperation, listAuthorizedCreatorOperations } from "@/auth/authorize-operation";

const CACHE_TTL_MS = 10 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CreatorAnalyticsRange = { start: string; end: string };
export type CreatorAnalyticsExportTarget = { id: string; username: string; avatar: string; isSelf: boolean };
export type CreatorAnalyticsExportResult = { filename: string; csv: string };

const CREATOR_ANALYTICS_EXPORT_DATASETS: CreatorAnalyticsExportDataset[] = ["daily", "acquisition", "locations", "technology"];

function normalizedRange(range?: CreatorAnalyticsRange | null): CreatorAnalyticsRange | null {
	if (!range || !ISO_DATE.test(range.start) || !ISO_DATE.test(range.end) || range.start > range.end) return null;
	const start = new Date(`${range.start}T00:00:00Z`);
	const end = new Date(`${range.end}T00:00:00Z`);
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
	const maximumRangeMs = 366 * 5 * 24 * 60 * 60 * 1000;
	return end.getTime() - start.getTime() <= maximumRangeMs ? range : null;
}

async function ownerForActor(ownerId: string, permission: "analytics:read" | "analytics:export") {
	const access = await authorizeCreatorOperation({ creatorId: ownerId, resourceOwnerId: ownerId, permission, requiredEntitlement: "pro" });
	if (!access.allowed) return null;
	const ownerWithEntitlements = { ...access.creator, entitlements: await resolveUserEntitlements(access.creator) };
	return getFeatureAccess(ownerWithEntitlements, "creator_page_analytics").allowed ? ownerWithEntitlements : null;
}

async function loadCreatorAnalytics(owner: typeof usersTable.$inferSelect, range?: CreatorAnalyticsRange | null): Promise<(CreatorAnalyticsData & { stale: boolean; fetchedAt: string }) | null> {
	const today = new Date().toISOString().slice(0, 10);
	const dateRange = normalizedRange(range) ?? { end: today, start: new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10) };
	const cacheKey = `umami-v1:${umamiWebsiteId()}:${resolveBaseUrl().hostname}:${owner.username}:${dateRange.start}:${dateRange.end}`;
	const cacheRows = await db
		.select()
		.from(plausibleStatsCacheTable)
		.where(and(eq(plausibleStatsCacheTable.ownerId, owner.id), eq(plausibleStatsCacheTable.cacheKey, cacheKey)))
		.execute();
	const cached = cacheRows.find((row) => row.cacheKey === cacheKey);
	const parseResult = (payload: CreatorAnalyticsData, fetchedAt: Date, stale: boolean) => ({ ...fillEmptyCreatorAnalyticsRange(payload, dateRange.start, dateRange.end), stale, fetchedAt: fetchedAt.toISOString() });
	if (cached && cached.expiresAt.getTime() > Date.now()) {
		recordCreatorAnalyticsMetric("hits");
		return parseResult(JSON.parse(cached.value) as CreatorAnalyticsData, cached.fetchedAt, false);
	}
	recordCreatorAnalyticsMetric("misses");
	try {
		const payload = await getUmamiCreatorAnalytics(owner.username, dateRange);
		const fetchedAt = new Date();
		await db
			.insert(plausibleStatsCacheTable)
			.values({ ownerId: owner.id, cacheKey, value: JSON.stringify(payload), fetchedAt, expiresAt: new Date(fetchedAt.getTime() + CACHE_TTL_MS), lastErrorAt: null })
			.onConflictDoUpdate({ target: [plausibleStatsCacheTable.ownerId, plausibleStatsCacheTable.cacheKey], set: { value: JSON.stringify(payload), fetchedAt, expiresAt: new Date(fetchedAt.getTime() + CACHE_TTL_MS), lastErrorAt: null } })
			.execute();
		return parseResult(payload, fetchedAt, false);
	} catch (error) {
		recordCreatorAnalyticsMetric("apiFailures");
		console.error("[creator-analytics] failed to refresh Umami cache", { ownerId: owner.id, error });
		if (!cached) return null;
		recordCreatorAnalyticsMetric("staleFallbacks");
		await db
			.update(plausibleStatsCacheTable)
			.set({ lastErrorAt: new Date() })
			.where(and(eq(plausibleStatsCacheTable.ownerId, owner.id), eq(plausibleStatsCacheTable.cacheKey, cacheKey)));
		return parseResult(JSON.parse(cached.value) as CreatorAnalyticsData, cached.fetchedAt, true);
	}
}

export async function getOwnCreatorAnalytics(range?: CreatorAnalyticsRange | null) {
	const candidates = await listAuthorizedCreatorOperations({ permission: "analytics:read", requiredEntitlement: "pro" });
	const access = candidates.find((candidate) => candidate.accessPath === "owner") ?? candidates[0];
	if (!access) return null;
	const owner = { ...access.creator, entitlements: await resolveUserEntitlements(access.creator) };
	if (!getFeatureAccess(owner, "creator_page_analytics").allowed) return null;
	return loadCreatorAnalytics(owner, range);
}

export async function getCreatorAnalytics(ownerId: string, range?: CreatorAnalyticsRange | null) {
	const owner = await ownerForActor(ownerId, "analytics:read");
	return owner ? loadCreatorAnalytics(owner, range) : null;
}

export async function getCreatorAnalyticsExportTargets(): Promise<CreatorAnalyticsExportTarget[]> {
	const candidates = await listAuthorizedCreatorOperations({ permission: "analytics:export", requiredEntitlement: "pro" });
	const eligibleManaged: CreatorAnalyticsExportTarget[] = [];
	for (const candidate of candidates) {
		const entitlements = await resolveUserEntitlements(candidate.creator);
		if (getFeatureAccess({ ...candidate.creator, entitlements }, "creator_page_analytics").allowed) eligibleManaged.push({ id: candidate.creator.id, username: candidate.creator.username, avatar: candidate.creator.avatar, isSelf: candidate.accessPath === "owner" });
	}
	return eligibleManaged.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.username.localeCompare(b.username));
}

export async function exportCreatorAnalyticsBundle(input: { ownerId: string; range?: CreatorAnalyticsRange | null; datasets: CreatorAnalyticsExportDataset[] }): Promise<CreatorAnalyticsExportResult[] | null> {
	const datasets = [...new Set(input.datasets)];
	if (datasets.length === 0 || datasets.some((dataset) => !CREATOR_ANALYTICS_EXPORT_DATASETS.includes(dataset))) return null;
	const owner = await ownerForActor(input.ownerId, "analytics:export");
	if (!owner) return null;
	const analytics = await loadCreatorAnalytics(owner, input.range);
	if (!analytics) return null;
	const range = normalizedRange(input.range);
	const rangeLabel = range ? `${range.start}_${range.end}` : "last-30-days";
	return datasets.map((dataset) => ({
		filename: `clipify-${owner.username}-${dataset}-${rangeLabel}.csv`.replace(/[^a-zA-Z0-9._-]/g, "-"),
		csv: createCreatorAnalyticsCsv(analytics, dataset),
	}));
}

export async function exportCreatorAnalytics(input: { ownerId: string; range?: CreatorAnalyticsRange | null; dataset: CreatorAnalyticsExportDataset }) {
	const results = await exportCreatorAnalyticsBundle({ ownerId: input.ownerId, range: input.range, datasets: [input.dataset] });
	return results?.[0] ?? null;
}
