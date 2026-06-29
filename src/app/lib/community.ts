import "server-only";

import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db, dbPool } from "@/db/client";
import { entitlementGrantsTable, overlaysTable, settingsTable, twitchCacheTable, usersTable } from "@/db/schema";
import { Entitlement, EntitlementGrantSource, Plan, TwitchCacheType, type TwitchApiResponse, type TwitchUserResponse, type UserEntitlements } from "@types";
import { resolveUserEntitlementsForUsers } from "@lib/entitlements";
import { getAppAccessToken, getUsersDetailsBulk } from "@actions/twitch";

import type { CommunitySnapshot, CommunityStreamer, CommunityStreamerStatus } from "./community-types";
import { compareCommunityStreamers } from "./communitySort";

const TWITCH_BATCH_LIMIT = 100;
const COMMUNITY_SNAPSHOT_CACHE_TYPE = TwitchCacheType.User;
const COMMUNITY_SNAPSHOT_CACHE_KEY = "community:snapshot";
const COMMUNITY_SNAPSHOT_CACHE_TTL_SECONDS = 120;
const COMMUNITY_REFRESH_LOCK_KEY = "community_snapshot_refresh";
const PLAUSIBLE_BASE_URL = (process.env.PLAUSIBLE_BASE_URL || "https://analytics.thedannicraft.de").replace(/\/+$/, "");
const PLAUSIBLE_SITE_ID = process.env.PLAUSIBLE_SITE_ID || "clipify.us";
const PLAUSIBLE_WINDOW_MINUTES = 5;

type CommunityUserRow = {
	id: string;
	username: string;
	avatar: string;
	plan: Plan;
	lastLogin: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

type PlausibleQueryResponse = {
	results?: Array<{
		dimensions?: string[];
		metrics?: number[];
	}>;
};

type TwitchStreamResponse = {
	user_id: string;
};

type LockClient = {
	query: (text: string, values?: unknown[]) => Promise<unknown>;
	release: () => void;
};

let communitySnapshotRefreshPromise: Promise<CommunitySnapshot | null> | null = null;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}
	return chunks;
}

function emptyCommunitySnapshot(): CommunitySnapshot {
	return {
		streamers: [],
		totalCount: 0,
		liveCount: 0,
		overlayActiveCount: 0,
		updatedAt: new Date().toISOString(),
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function parseCommunitySnapshot(value: string): CommunitySnapshot | null {
	try {
		const parsed = JSON.parse(value) as CommunitySnapshot;
		if (!parsed || !Array.isArray(parsed.streamers)) return null;
		return parsed;
	} catch (error) {
		console.error("[community] failed to parse snapshot cache", error);
		return null;
	}
}

async function readCommunitySnapshotFromCache(stale = false): Promise<CommunitySnapshot | null> {
	try {
		const now = new Date();
		const baseConditions = [eq(twitchCacheTable.type, COMMUNITY_SNAPSHOT_CACHE_TYPE), eq(twitchCacheTable.key, COMMUNITY_SNAPSHOT_CACHE_KEY)];
		const freshnessCondition = stale ? undefined : or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, now));
		const rows = await db
			.select({ value: twitchCacheTable.value })
			.from(twitchCacheTable)
			.where(freshnessCondition ? and(...baseConditions, freshnessCondition) : and(...baseConditions))
			.limit(1)
			.execute();
		if (rows.length === 0) return null;
		return parseCommunitySnapshot(rows[0].value);
	} catch (error) {
		console.error("[community] failed to read snapshot cache", error);
		return null;
	}
}

async function writeCommunitySnapshotToCache(snapshot: CommunitySnapshot): Promise<void> {
	try {
		const now = new Date();
		const expiresAt = new Date(now.getTime() + COMMUNITY_SNAPSHOT_CACHE_TTL_SECONDS * 1000);
		const payload = JSON.stringify(snapshot);

		await db
			.insert(twitchCacheTable)
			.values({
				type: COMMUNITY_SNAPSHOT_CACHE_TYPE,
				key: COMMUNITY_SNAPSHOT_CACHE_KEY,
				value: payload,
				fetchedAt: now,
				expiresAt,
			})
			.onConflictDoUpdate({
				target: [twitchCacheTable.type, twitchCacheTable.key],
				set: {
					value: payload,
					fetchedAt: now,
					expiresAt,
				},
			})
			.execute();
	} catch (error) {
		console.error("[community] failed to write snapshot cache", error);
	}
}

export async function invalidateCommunitySnapshotCache(): Promise<void> {
	try {
		await db.delete(twitchCacheTable).where(and(eq(twitchCacheTable.type, COMMUNITY_SNAPSHOT_CACHE_TYPE), eq(twitchCacheTable.key, COMMUNITY_SNAPSHOT_CACHE_KEY))).execute();
	} catch (error) {
		console.error("[community] failed to invalidate snapshot cache", error);
	}
}

async function withRefreshLock<T>(task: () => Promise<T>): Promise<T | null> {
	let lockClient: LockClient | null = null;
	let lockAcquired = false;
	try {
		lockClient = await dbPool.connect();
		const lockResult = (await lockClient.query("select pg_try_advisory_lock(hashtext($1)) as locked", [COMMUNITY_REFRESH_LOCK_KEY])) as { rows?: Array<{ locked?: boolean }> };
		lockAcquired = Boolean(lockResult.rows?.[0]?.locked);
		if (!lockAcquired) return null;
		return await task();
	} finally {
		if (lockClient && lockAcquired) {
			try {
				await lockClient.query("select pg_advisory_unlock(hashtext($1))", [COMMUNITY_REFRESH_LOCK_KEY]);
			} catch {
				// Best-effort unlock.
			}
		}
		lockClient?.release();
	}
}

async function fetchCommunityUsers(): Promise<CommunityUserRow[]> {
	return db
		.select({
			id: usersTable.id,
			username: usersTable.username,
			avatar: usersTable.avatar,
			plan: usersTable.plan,
			lastLogin: usersTable.lastLogin,
			createdAt: usersTable.createdAt,
			updatedAt: usersTable.updatedAt,
		})
		.from(usersTable)
		.innerJoin(overlaysTable, eq(overlaysTable.ownerId, usersTable.id))
		.leftJoin(settingsTable, eq(settingsTable.id, usersTable.id))
		.where(and(eq(usersTable.disabled, false), eq(settingsTable.showOnCommunityPage, true)))
		.groupBy(usersTable.id, usersTable.username, usersTable.avatar, usersTable.plan, usersTable.lastLogin, usersTable.createdAt, usersTable.updatedAt)
		.execute();
}

async function fetchOverlayIdsByOwner(ownerIds: string[]): Promise<Map<string, Set<string>>> {
	const overlayIdsByOwner = new Map<string, Set<string>>();
	if (ownerIds.length === 0) return overlayIdsByOwner;

	const rows = await db.select({ ownerId: overlaysTable.ownerId, overlayId: overlaysTable.id }).from(overlaysTable).where(inArray(overlaysTable.ownerId, ownerIds)).execute();
	for (const row of rows) {
		let overlayIds = overlayIdsByOwner.get(row.ownerId);
		if (!overlayIds) {
			overlayIds = new Set<string>();
			overlayIdsByOwner.set(row.ownerId, overlayIds);
		}
		overlayIds.add(row.overlayId);
	}

	return overlayIdsByOwner;
}

async function fetchPartnerOwnerIds(ownerIds: string[]): Promise<Set<string>> {
	const partnerOwnerIds = new Set<string>();
	if (ownerIds.length === 0) return partnerOwnerIds;

	const rows = await db
		.select({ userId: entitlementGrantsTable.userId })
		.from(entitlementGrantsTable)
		.where(
			and(
				eq(entitlementGrantsTable.entitlement, Entitlement.ProAccess),
				eq(entitlementGrantsTable.source, EntitlementGrantSource.Partner),
				lte(entitlementGrantsTable.startsAt, sql`now()`),
				or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)),
				or(inArray(entitlementGrantsTable.userId, ownerIds), isNull(entitlementGrantsTable.userId)),
			),
		)
		.execute();

	for (const row of rows) {
		if (row.userId) partnerOwnerIds.add(row.userId);
	}

	return partnerOwnerIds;
}

async function fetchTwitchUsers(ownerIds: string[], accessToken: string): Promise<Map<string, TwitchUserResponse>> {
	const result = new Map<string, TwitchUserResponse>();
	for (const batch of chunkArray(ownerIds, TWITCH_BATCH_LIMIT)) {
		try {
			const users = await getUsersDetailsBulk({ userIds: batch, accessToken });
			for (const user of users) {
				result.set(user.id, user);
			}
		} catch (error) {
			console.error("[community] failed to fetch twitch users batch", { batchSize: batch.length, error });
		}
	}

	return result;
}

async function fetchLiveOwnerIds(ownerIds: string[], accessToken: string): Promise<Set<string>> {
	const liveOwnerIds = new Set<string>();
	for (const batch of chunkArray(ownerIds, TWITCH_BATCH_LIMIT)) {
		try {
			const url = new URL("https://api.twitch.tv/helix/streams");
			for (const ownerId of batch) {
				url.searchParams.append("user_id", ownerId);
			}
			url.searchParams.set("first", "100");

			const response = await fetch(url.toString(), {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			});

			if (!response.ok) continue;

			const payload = (await response.json()) as TwitchApiResponse<TwitchStreamResponse>;
			for (const stream of payload.data ?? []) {
				liveOwnerIds.add(stream.user_id);
			}
		} catch (error) {
			console.error("[community] failed to fetch live status batch", { batchSize: batch.length, error });
		}
	}

	return liveOwnerIds;
}

async function fetchActiveOverlayIdsFromPlausible(): Promise<Set<string>> {
	const apiKey = process.env.PLAUSIBLE_API_KEY;
	if (!apiKey) return new Set<string>();

	try {
		const now = new Date();
		const since = new Date(now.getTime() - PLAUSIBLE_WINDOW_MINUTES * 60 * 1000);
		const response = await fetch(`${PLAUSIBLE_BASE_URL}/api/v2/query`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				site_id: PLAUSIBLE_SITE_ID,
				metrics: ["visitors"],
				dimensions: ["event:page"],
				date_range: [since.toISOString(), now.toISOString()],
				filters: [["matches", "event:page", ["^/overlay/[^/]+$"]]],
				order_by: [["visitors", "desc"]],
			}),
		});

		if (!response.ok) {
			console.error("[community] failed to query Plausible", response.status, await response.text());
			return new Set<string>();
		}

		const payload = (await response.json()) as PlausibleQueryResponse;
		const overlayIds = new Set<string>();
		for (const row of payload.results ?? []) {
			const pagePath = row.dimensions?.[0] ?? "";
			const match = pagePath.match(/^\/overlay\/([^/?#]+)/);
			if (match?.[1]) {
				overlayIds.add(match[1]);
			}
		}

		return overlayIds;
	} catch (error) {
		console.error("[community] failed to fetch active overlays from Plausible", error);
		return new Set<string>();
	}
}

async function buildCommunitySnapshot(): Promise<CommunitySnapshot> {
	const users = await fetchCommunityUsers();
	if (users.length === 0) {
		return emptyCommunitySnapshot();
	}

	const ownerIds = users.map((user) => user.id);
	const overlayIdsByOwner = await fetchOverlayIdsByOwner(ownerIds);
	const partnerOwnerIds = await fetchPartnerOwnerIds(ownerIds);

	let entitlementsByUserId = new Map<string, UserEntitlements>();
	try {
		entitlementsByUserId = await resolveUserEntitlementsForUsers(users.map((user) => ({ id: user.id, plan: user.plan })));
	} catch (error) {
		console.error("[community] failed to resolve entitlements", error);
	}

	const appToken = await getAppAccessToken().catch((error) => {
		console.error("[community] failed to fetch Twitch app token", error);
		return null;
	});

	const [twitchUsers, liveOwnerIds, activeOverlayIds] = await Promise.all([
		appToken ? fetchTwitchUsers(ownerIds, appToken.access_token) : Promise.resolve(new Map<string, TwitchUserResponse>()),
		appToken ? fetchLiveOwnerIds(ownerIds, appToken.access_token) : Promise.resolve(new Set<string>()),
		fetchActiveOverlayIdsFromPlausible(),
	]);

	const streamers = users.map((user) => {
		const twitchUser = twitchUsers.get(user.id);
		const overlayIds = overlayIdsByOwner.get(user.id);
		const hasActiveOverlay = Boolean(overlayIds && [...overlayIds].some((overlayId) => activeOverlayIds.has(overlayId)));
		const isLive = liveOwnerIds.has(user.id);
		const status: CommunityStreamerStatus = isLive && hasActiveOverlay ? "live_with_overlay" : isLive ? "live" : "offline";
		const entitlements = entitlementsByUserId.get(user.id);

		return {
			id: user.id,
			username: twitchUser?.login ?? user.username,
			displayName: twitchUser?.display_name ?? twitchUser?.login ?? user.username,
			avatar: twitchUser?.profile_image_url ?? user.avatar,
			plan: entitlements?.effectivePlan === "pro" || user.plan === Plan.Pro ? Plan.Pro : Plan.Free,
			viewCount: twitchUser?.view_count ?? 0,
			partner: partnerOwnerIds.has(user.id),
			status,
			lastActiveAt: (user.lastLogin ?? user.updatedAt ?? user.createdAt).toISOString(),
		} satisfies CommunityStreamer;
	});

	streamers.sort(compareCommunityStreamers);

	return {
		streamers,
		totalCount: streamers.length,
		liveCount: streamers.filter((streamer) => streamer.status !== "offline").length,
		overlayActiveCount: streamers.filter((streamer) => streamer.status === "live_with_overlay").length,
		updatedAt: new Date().toISOString(),
	};
}

export async function refreshCommunitySnapshot(): Promise<CommunitySnapshot | null> {
	if (communitySnapshotRefreshPromise) return communitySnapshotRefreshPromise;

	communitySnapshotRefreshPromise = withRefreshLock(async () => {
		const snapshot = await buildCommunitySnapshot();
		await writeCommunitySnapshotToCache(snapshot);
		return snapshot;
	}).finally(() => {
		communitySnapshotRefreshPromise = null;
	});

	return communitySnapshotRefreshPromise;
}

async function waitForCommunitySnapshot(timeoutMs = 2_000): Promise<CommunitySnapshot | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const fresh = await readCommunitySnapshotFromCache(false);
		if (fresh) return fresh;
		await sleep(100);
	}

	return readCommunitySnapshotFromCache(true);
}

export async function getCommunitySnapshot(): Promise<CommunitySnapshot> {
	const fresh = await readCommunitySnapshotFromCache(false);
	if (fresh) return fresh;

	const stale = await readCommunitySnapshotFromCache(true);
	if (stale) {
		void refreshCommunitySnapshot();
		return stale;
	}

	const refreshed = await refreshCommunitySnapshot();
	if (refreshed) return refreshed;

	const waited = await waitForCommunitySnapshot();
	if (waited) return waited;

	return emptyCommunitySnapshot();
}
