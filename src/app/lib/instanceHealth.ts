/* istanbul ignore file */
import { db } from "@/db/client";
import { entitlementGrantsTable, modQueueTable, overlaysTable, playlistClipsTable, playlistsTable, queueTable, settingsTable, tokenTable, twitchCacheTable, usersTable } from "@/db/schema";
import { getTwitchCacheReadMetricsSnapshot } from "@actions/database";
import { getClipCacheSchedulerStats } from "@lib/clipCacheScheduler";
import { and, count, countDistinct, eq, gt, isNotNull, isNull, like, lt, lte, notLike, or, sql } from "drizzle-orm";
import { Entitlement, EntitlementGrantSource, Plan, StatusOptions, TwitchCacheType } from "@types";

type HealthStatus = "ok" | "degraded" | "down";

export type InstanceHealthSnapshot = {
	status: HealthStatus;
	time: string;
	uptimeSec: number;
	app: {
		env: string;
		version: string;
	};
	counts: {
		users: number;
		usersFree: number;
		usersPaid: number;
		activeUsers24h: number;
		activeUsers7d: number;
		activeUsers30d: number;
		overlaysTotal: number;
		overlaysActive: number;
		overlaysPaused: number;
		activeOverlayOwnersFree: number;
		activeOverlayOwnersPaid: number;
	};
	accounts: {
		disabledUsers: number;
		disabledManual: number;
		disabledAutomatic: number;
		neverLoggedIn: number;
		disabledReasonCounts: Record<string, number>;
	};
	playlists: {
		total: number;
		nonEmpty: number;
		empty: number;
		clipRows: number;
		avgClipsPerPlaylist: number;
		overlaysWithPlaylist: number;
		activeOverlaysWithPlaylist: number;
	};
	newsletter: {
		settingsRows: number;
		optedIn: number;
		optedOut: number;
		consentSourceCounts: Record<string, number>;
		optedOutReasonCounts: Record<string, number>;
	};
	queues: {
		clipQueueDepth: number;
		modQueueDepth: number;
	};
	auth: {
		tokenRows: number;
		expiredTokens: number;
		expiringIn24h: number;
	};
	entitlements: {
		activeGrantUsers: number;
		activeGrantUsersOnFree: number;
		activeGrantCount: number;
		effectiveProUsersEstimate: number;
		grantsBySource: Record<string, number>;
		grantsByEntitlement: Record<string, number>;
	};
	cache: {
		entriesTotal: number;
		clipEntries: number;
		avatarEntries: number;
		gameEntries: number;
		unavailableClips: number;
		clipSyncStates: number;
		clipSyncComplete: number;
		backfillCompleteRatio: number;
		staleValidatedClips: number;
		globalReadHitRate: number;
		globalReadTotal: number;
		globalReadHits: number;
		globalReadMisses: number;
		globalStaleHits: number;
		cacheReadMetricsStartedAt: string;
		lastCacheReadAt: string | null;
	};
	scheduler: {
		clipCache: ReturnType<typeof getClipCacheSchedulerStats>;
	};
	db: {
		ok: boolean;
		latencyMs: number;
	};
};

async function countRows(table: typeof usersTable | typeof overlaysTable | typeof playlistsTable) {
	const result = await db.select({ count: count() }).from(table).execute();
	return Number(result[0]?.count ?? 0);
}

async function countWhereOverlays(status: StatusOptions) {
	const result = await db.select({ count: count() }).from(overlaysTable).where(eq(overlaysTable.status, status)).execute();
	return Number(result[0]?.count ?? 0);
}

export async function getInstanceHealthSnapshot(): Promise<InstanceHealthSnapshot> {
	const started = Date.now();
	const now = new Date();
	const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
	const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const [usersTotal, overlaysTotal, overlaysActive, overlaysPaused, activeUsers24h, activeUsers7d, activeUsers30d, disabledUsers, disabledManual, disabledAutomatic, neverLoggedIn, disabledReasonRows] = await Promise.all([
		countRows(usersTable),
		countRows(overlaysTable),
		countWhereOverlays(StatusOptions.Active),
		countWhereOverlays(StatusOptions.Paused),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(and(isNotNull(usersTable.lastLogin), gt(usersTable.lastLogin, dayAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(and(isNotNull(usersTable.lastLogin), gt(usersTable.lastLogin, weekAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(and(isNotNull(usersTable.lastLogin), gt(usersTable.lastLogin, monthAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(eq(usersTable.disabled, true))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(and(eq(usersTable.disabled, true), eq(usersTable.disableType, "manual")))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(and(eq(usersTable.disabled, true), eq(usersTable.disableType, "automatic")))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: count() })
			.from(usersTable)
			.where(isNull(usersTable.lastLogin))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({
				reason: usersTable.disabledReason,
				count: count(),
			})
			.from(usersTable)
			.where(eq(usersTable.disabled, true))
			.groupBy(usersTable.disabledReason)
			.execute(),
	]);
	const disabledReasonCounts = disabledReasonRows.reduce<Record<string, number>>((acc, row) => {
		acc[(row.reason ?? "unknown").trim() || "unknown"] = Number(row.count ?? 0);
		return acc;
	}, {});

	const usersByPlan = await db
		.select({
			plan: usersTable.plan,
			count: count(),
		})
		.from(usersTable)
		.groupBy(usersTable.plan)
		.execute();
	const freeUsers = Number(usersByPlan.find((row) => row.plan === Plan.Free)?.count ?? 0);
	const paidUsers = Number(usersByPlan.find((row) => row.plan === Plan.Pro)?.count ?? 0);

	const activeGrants = await db
		.select({
			source: entitlementGrantsTable.source,
			entitlement: entitlementGrantsTable.entitlement,
			count: count(),
		})
		.from(entitlementGrantsTable)
		.where(and(lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`))))
		.groupBy(entitlementGrantsTable.source, entitlementGrantsTable.entitlement)
		.execute();

	const activeGrantUsersResult = await db
		.select({ count: countDistinct(entitlementGrantsTable.userId) })
		.from(entitlementGrantsTable)
		.where(and(lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)), isNotNull(entitlementGrantsTable.userId)))
		.execute();
	const activeGrantUsers = Number(activeGrantUsersResult[0]?.count ?? 0);

	const activeGrantUsersOnFreeResult = await db
		.select({ count: countDistinct(entitlementGrantsTable.userId) })
		.from(entitlementGrantsTable)
		.innerJoin(usersTable, eq(entitlementGrantsTable.userId, usersTable.id))
		.where(and(lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)), isNotNull(entitlementGrantsTable.userId), eq(usersTable.plan, Plan.Free)))
		.execute();
	const activeGrantUsersOnFree = Number(activeGrantUsersOnFreeResult[0]?.count ?? 0);
	const activeGrantCount = activeGrants.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
	const effectiveProUsersEstimate = paidUsers + activeGrantUsersOnFree;

	const activeOverlayOwnersByPlanRows = await db
		.select({
			plan: usersTable.plan,
			count: countDistinct(overlaysTable.ownerId),
		})
		.from(overlaysTable)
		.innerJoin(usersTable, eq(overlaysTable.ownerId, usersTable.id))
		.where(eq(overlaysTable.status, StatusOptions.Active))
		.groupBy(usersTable.plan)
		.execute();
	const activeOverlayOwnersFree = Number(activeOverlayOwnersByPlanRows.find((row) => row.plan === Plan.Free)?.count ?? 0);
	const activeOverlayOwnersPaid = Number(activeOverlayOwnersByPlanRows.find((row) => row.plan === Plan.Pro)?.count ?? 0);

	const [playlistsTotal, playlistClipRows, nonEmptyPlaylistsRows, overlaysWithPlaylistRows, activeOverlaysWithPlaylistRows] = await Promise.all([
		countRows(playlistsTable),
		db
			.select({ count: count() })
			.from(playlistClipsTable)
			.execute(),
		db
			.select({ count: countDistinct(playlistClipsTable.playlistId) })
			.from(playlistClipsTable)
			.execute(),
		db
			.select({ count: count() })
			.from(overlaysTable)
			.where(isNotNull(overlaysTable.playlistId))
			.execute(),
		db
			.select({ count: count() })
			.from(overlaysTable)
			.where(and(eq(overlaysTable.status, StatusOptions.Active), isNotNull(overlaysTable.playlistId)))
			.execute(),
	]);
	const playlistClipCount = Number(playlistClipRows[0]?.count ?? 0);
	const nonEmptyPlaylists = Number(nonEmptyPlaylistsRows[0]?.count ?? 0);
	const emptyPlaylists = Math.max(0, playlistsTotal - nonEmptyPlaylists);
	const overlaysWithPlaylist = Number(overlaysWithPlaylistRows[0]?.count ?? 0);
	const activeOverlaysWithPlaylist = Number(activeOverlaysWithPlaylistRows[0]?.count ?? 0);
	const avgClipsPerPlaylist = playlistsTotal > 0 ? playlistClipCount / playlistsTotal : 0;

	const [settingsRows, optedInRows, optedOutRows, newsletterConsentSourceRows, optedOutReasonRows] = await Promise.all([
		db
			.select({ count: count() })
			.from(settingsTable)
			.execute(),
		db
			.select({ count: count() })
			.from(settingsTable)
			.where(eq(settingsTable.marketingOptIn, true))
			.execute(),
		db
			.select({ count: count() })
			.from(settingsTable)
			.where(eq(settingsTable.marketingOptIn, false))
			.execute(),
		db
			.select({
				source: settingsTable.marketingOptInSource,
				count: count(),
			})
			.from(settingsTable)
			.groupBy(settingsTable.marketingOptInSource)
			.execute(),
		db
			.select({
				source: settingsTable.marketingOptInSource,
				count: count(),
			})
			.from(settingsTable)
			.where(eq(settingsTable.marketingOptIn, false))
			.groupBy(settingsTable.marketingOptInSource)
			.execute(),
	]);
	const consentSourceCounts = newsletterConsentSourceRows.reduce<Record<string, number>>((acc, row) => {
		acc[row.source ?? "unknown"] = Number(row.count ?? 0);
		return acc;
	}, {});
	const optedOutReasonCounts = optedOutReasonRows.reduce<Record<string, number>>((acc, row) => {
		acc[row.source ?? "unknown"] = Number(row.count ?? 0);
		return acc;
	}, {});

	const [clipQueueRows, modQueueRows] = await Promise.all([
		db
			.select({ count: count() })
			.from(queueTable)
			.execute(),
		db
			.select({ count: count() })
			.from(modQueueTable)
			.execute(),
	]);

	const [tokenRows, expiredTokensRows, expiringIn24hRows] = await Promise.all([
		db
			.select({ count: count() })
			.from(tokenTable)
			.execute(),
		db
			.select({ count: count() })
			.from(tokenTable)
			.where(lt(tokenTable.expiresAt, now))
			.execute(),
		db
			.select({ count: count() })
			.from(tokenTable)
			.where(and(gt(tokenTable.expiresAt, now), lte(tokenTable.expiresAt, in24h)))
			.execute(),
	]);

	const grantsBySource = Object.values(EntitlementGrantSource).reduce<Record<string, number>>((acc, source) => {
		acc[source] = Number(activeGrants.filter((row) => row.source === source).reduce((sum, row) => sum + Number(row.count ?? 0), 0));
		return acc;
	}, {});
	const grantsByEntitlement = Object.values(Entitlement).reduce<Record<string, number>>((acc, entitlement) => {
		acc[entitlement] = Number(activeGrants.filter((row) => row.entitlement === entitlement).reduce((sum, row) => sum + Number(row.count ?? 0), 0));
		return acc;
	}, {});

	const cacheTotals = await db
		.select({
			type: twitchCacheTable.type,
			count: count(),
		})
		.from(twitchCacheTable)
		.groupBy(twitchCacheTable.type)
		.execute();

	const cacheTotalEntries = cacheTotals.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
	const clipEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Clip)?.count ?? 0);
	const avatarEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Avatar)?.count ?? 0);
	const gameEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Game)?.count ?? 0);

	const [unavailableClipsRows, clipSyncStatesRows, clipSyncCompleteRows, staleValidatedRows] = await Promise.all([
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.value, '%"unavailable":true%')))
			.execute(),
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.key, "clip-sync:%"), notLike(twitchCacheTable.key, "clip-sync-force:%")))
			.execute(),
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.key, "clip-sync:%"), notLike(twitchCacheTable.key, "clip-sync-force:%"), like(twitchCacheTable.value, '%"backfillComplete":true%')))
			.execute(),
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.key, "clip:%"), like(twitchCacheTable.value, '%"lastValidatedAt":%'), lt(twitchCacheTable.fetchedAt, sql`now() - interval '6 hours'`)))
			.execute(),
	]);

	const unavailableClips = Number(unavailableClipsRows[0]?.count ?? 0);
	const staleValidatedClips = Number(staleValidatedRows[0]?.count ?? 0);
	const clipSyncStates = Number(clipSyncStatesRows[0]?.count ?? 0);
	const clipSyncCompleteCount = Number(clipSyncCompleteRows[0]?.count ?? 0);
	const backfillCompleteRatio = clipSyncStates > 0 ? clipSyncCompleteCount / clipSyncStates : 0;

	const scheduler = getClipCacheSchedulerStats();
	const cacheReads = await getTwitchCacheReadMetricsSnapshot();
	const dbLatencyMs = Date.now() - started;

	let status: HealthStatus = "ok";
	if (dbLatencyMs > 2000 || (scheduler.totalRuns > 0 && scheduler.totalFailures / scheduler.totalRuns > 0.15)) status = "degraded";
	if (dbLatencyMs > 5000) status = "down";

	return {
		status,
		time: now.toISOString(),
		uptimeSec: Math.floor(process.uptime()),
		app: {
			env: process.env.NODE_ENV ?? "unknown",
			version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev",
		},
		counts: {
			users: usersTotal,
			usersFree: freeUsers,
			usersPaid: paidUsers,
			activeUsers24h,
			activeUsers7d,
			activeUsers30d,
			overlaysTotal,
			overlaysActive,
			overlaysPaused,
			activeOverlayOwnersFree,
			activeOverlayOwnersPaid,
		},
		accounts: {
			disabledUsers,
			disabledManual,
			disabledAutomatic,
			neverLoggedIn,
			disabledReasonCounts,
		},
		playlists: {
			total: playlistsTotal,
			nonEmpty: nonEmptyPlaylists,
			empty: emptyPlaylists,
			clipRows: playlistClipCount,
			avgClipsPerPlaylist,
			overlaysWithPlaylist,
			activeOverlaysWithPlaylist,
		},
		newsletter: {
			settingsRows: Number(settingsRows[0]?.count ?? 0),
			optedIn: Number(optedInRows[0]?.count ?? 0),
			optedOut: Number(optedOutRows[0]?.count ?? 0),
			consentSourceCounts,
			optedOutReasonCounts,
		},
		queues: {
			clipQueueDepth: Number(clipQueueRows[0]?.count ?? 0),
			modQueueDepth: Number(modQueueRows[0]?.count ?? 0),
		},
		auth: {
			tokenRows: Number(tokenRows[0]?.count ?? 0),
			expiredTokens: Number(expiredTokensRows[0]?.count ?? 0),
			expiringIn24h: Number(expiringIn24hRows[0]?.count ?? 0),
		},
		entitlements: {
			activeGrantUsers,
			activeGrantUsersOnFree,
			activeGrantCount,
			effectiveProUsersEstimate,
			grantsBySource,
			grantsByEntitlement,
		},
		cache: {
			entriesTotal: cacheTotalEntries,
			clipEntries,
			avatarEntries,
			gameEntries,
			unavailableClips,
			clipSyncStates,
			clipSyncComplete: clipSyncCompleteCount,
			backfillCompleteRatio,
			staleValidatedClips,
			globalReadHitRate: cacheReads.hitRate,
			globalReadTotal: cacheReads.totalReads,
			globalReadHits: cacheReads.hits,
			globalReadMisses: cacheReads.misses,
			globalStaleHits: cacheReads.staleHits,
			cacheReadMetricsStartedAt: cacheReads.startedAt,
			lastCacheReadAt: cacheReads.lastReadAt,
		},
		scheduler: {
			clipCache: scheduler,
		},
		db: {
			ok: dbLatencyMs < 5000,
			latencyMs: dbLatencyMs,
		},
	};
}
