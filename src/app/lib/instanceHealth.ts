/* istanbul ignore file */
import { db } from "@/db/client";
import { billingSubscriptionItemsTable, billingSubscriptionsTable, entitlementGrantsTable, modQueueTable, overlaysTable, playlistClipsTable, playlistsTable, queueTable, runnersTable, settingsTable, streamSessionsTable, tokenTable, twitchCacheTable, usersTable } from "@/db/schema";
import { getTwitchCacheReadMetricsSnapshot } from "@actions/database";
import { getClipCacheSchedulerStats } from "@lib/clipCacheScheduler";
import { and, arrayContains, count, countDistinct, eq, gt, isNotNull, isNull, like, lt, lte, notLike, or, sql } from "drizzle-orm";
import { BillingProduct, Entitlement, EntitlementGrantSource, OverlayType, PlaybackMode, Plan, RunnerStatus, StatusOptions, StreamState, TwitchCacheType } from "@types";

type HealthStatus = "ok" | "degraded" | "down";

let v1GraphQLFetches = 0;
let v2TwitchApiFetches = 0;
let v2FallbackGraphQLFetches = 0;
let v2RateLimitedFetches = 0;

export type TwitchRateLimitLog = {
	broadcasterId: string;
	clipId: string;
	limit: string | null;
	remaining: string | null;
	reset: string | null;
	timestamp: string;
};

const twitchRateLimitHistory: TwitchRateLimitLog[] = [];

export function incrementClipFetchV1() {
	v1GraphQLFetches++;
}
export function incrementClipFetchV2() {
	v2TwitchApiFetches++;
}
export function incrementClipFetchFallback() {
	v2FallbackGraphQLFetches++;
}
export function incrementClipFetchRateLimited() {
	v2RateLimitedFetches++;
}

export function recordTwitchRateLimit(log: TwitchRateLimitLog) {
	twitchRateLimitHistory.unshift(log);
	if (twitchRateLimitHistory.length > 50) {
		twitchRateLimitHistory.pop();
	}
}

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
	rewards: {
		overlaysWithReward: number;
		activeOverlaysWithReward: number;
		uniqueRewardIds: number;
		ownersWithReward: number;
	};
	overlayConfig: {
		byType: Record<string, number>;
		byPlaybackMode: Record<string, number>;
	};
	newsletter: {
		settingsRows: number;
		optedIn: number;
		optedOut: number;
		consentSourceCounts: Record<string, number>;
		optedOutSourceCounts: Record<string, number>;
	};
	community: {
		totalUsers: number;
		optedInUsers: number;
		optedOutUsers: number;
		optInRate: number;
	};
	queues: {
		clipQueueDepth: number;
		modQueueDepth: number;
	};
	clips: {
		fetches: {
			v1GraphQL: number;
			v2TwitchApi: number;
			v2FallbackGraphQL: number;
			v2RateLimited: number;
		};
	};
	twitchRateLimit: {
		history: TwitchRateLimitLog[];
	};
	auth: {
		tokenRows: number;
		expiredTokens: number;
		expiringIn24h: number;
		readyForTwitchApiUsers: number;
	};
	entitlements: {
		activeGrantUsers: number;
		activeGrantUsersOnFree: number;
		activeGrantCount: number;
		effectiveProUsersEstimate: number;
		grantsBySource: Record<string, number>;
		grantsByEntitlement: Record<string, number>;
	};
	billing: {
		activeSubscriptions: number;
		runnerSubscriptionsActive: number;
		runnerSubscriptionsPastDue: number;
		runnerSubscriptionsCanceling: number;
		runnerMonthlyRecurringRevenueCents: number;
		runnerAnnualRecurringRevenueCents: number;
	};
	runners: {
		total: number;
		online: number;
		offline: number;
		owners: number;
		streamSessionsTotal: number;
		streamsDesiredRunning: number;
		streamsActuallyRunning: number;
		streamsErrored: number;
		byOs: Record<string, number>;
		byVersion: Record<string, number>;
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
		pingMs: number;
		healthAggregationMs: number;
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

export async function getInstanceHealthSnapshot<TExclude extends keyof InstanceHealthSnapshot = never>(options?: { exclude?: TExclude[] }): Promise<Omit<InstanceHealthSnapshot, TExclude>> {
	const started = Date.now();
	const dbPingStarted = Date.now();
	await db.execute(sql`select 1`);
	const dbPingMs = Date.now() - dbPingStarted;
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
		.where(and(isNull(entitlementGrantsTable.revokedAt), lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`))))
		.groupBy(entitlementGrantsTable.source, entitlementGrantsTable.entitlement)
		.execute();

	const activeGrantUsersResult = await db
		.select({ count: countDistinct(entitlementGrantsTable.userId) })
		.from(entitlementGrantsTable)
		.where(and(isNull(entitlementGrantsTable.revokedAt), lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)), isNotNull(entitlementGrantsTable.userId)))
		.execute();
	const activeGrantUsers = Number(activeGrantUsersResult[0]?.count ?? 0);

	const activeGrantUsersOnFreeResult = await db
		.select({ count: countDistinct(entitlementGrantsTable.userId) })
		.from(entitlementGrantsTable)
		.innerJoin(usersTable, eq(entitlementGrantsTable.userId, usersTable.id))
		.where(and(isNull(entitlementGrantsTable.revokedAt), lte(entitlementGrantsTable.startsAt, sql`now()`), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)), isNotNull(entitlementGrantsTable.userId), eq(usersTable.plan, Plan.Free)))
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
		db.select({ count: count() }).from(playlistClipsTable).execute(),
		db
			.select({ count: countDistinct(playlistClipsTable.playlistId) })
			.from(playlistClipsTable)
			.execute(),
		db.select({ count: count() }).from(overlaysTable).where(isNotNull(overlaysTable.playlistId)).execute(),
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

	const [overlaysWithRewardRows, activeOverlaysWithRewardRows, uniqueRewardIdsRows, ownersWithRewardRows, overlaysByTypeRows, overlaysByPlaybackModeRows] = await Promise.all([
		db.select({ count: count() }).from(overlaysTable).where(isNotNull(overlaysTable.rewardId)).execute(),
		db
			.select({ count: count() })
			.from(overlaysTable)
			.where(and(eq(overlaysTable.status, StatusOptions.Active), isNotNull(overlaysTable.rewardId)))
			.execute(),
		db
			.select({ count: countDistinct(overlaysTable.rewardId) })
			.from(overlaysTable)
			.where(isNotNull(overlaysTable.rewardId))
			.execute(),
		db
			.select({ count: countDistinct(overlaysTable.ownerId) })
			.from(overlaysTable)
			.where(isNotNull(overlaysTable.rewardId))
			.execute(),
		db
			.select({
				type: overlaysTable.type,
				count: count(),
			})
			.from(overlaysTable)
			.groupBy(overlaysTable.type)
			.execute(),
		db
			.select({
				mode: overlaysTable.playbackMode,
				count: count(),
			})
			.from(overlaysTable)
			.groupBy(overlaysTable.playbackMode)
			.execute(),
	]);

	const overlayTypeCounts = Object.values(OverlayType).reduce<Record<string, number>>((acc, type) => {
		acc[type] = Number(overlaysByTypeRows.find((row) => row.type === type)?.count ?? 0);
		return acc;
	}, {});
	const playbackModeCounts = Object.values(PlaybackMode).reduce<Record<string, number>>((acc, mode) => {
		acc[mode] = Number(overlaysByPlaybackModeRows.find((row) => row.mode === mode)?.count ?? 0);
		return acc;
	}, {});

	const [settingsRows, optedInRows, optedOutRows, communityOptedInRows, newsletterConsentSourceRows, optedOutSourceRows] = await Promise.all([
		db.select({ count: count() }).from(settingsTable).execute(),
		db.select({ count: count() }).from(settingsTable).where(eq(settingsTable.marketingOptIn, true)).execute(),
		db.select({ count: count() }).from(settingsTable).where(eq(settingsTable.marketingOptIn, false)).execute(),
		db.select({ count: count() }).from(settingsTable).where(eq(settingsTable.showOnCommunityPage, true)).execute(),
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
	const optedOutSourceCounts = optedOutSourceRows.reduce<Record<string, number>>((acc, row) => {
		acc[row.source ?? "unknown"] = Number(row.count ?? 0);
		return acc;
	}, {});
	const communityOptedInUsers = Number(communityOptedInRows[0]?.count ?? 0);
	const communityOptedOutUsers = Math.max(0, usersTotal - communityOptedInUsers);
	const communityOptInRate = usersTotal > 0 ? communityOptedInUsers / usersTotal : 0;

	const [clipQueueRows, modQueueRows] = await Promise.all([db.select({ count: count() }).from(queueTable).execute(), db.select({ count: count() }).from(modQueueTable).execute()]);

	const [tokenRows, expiredTokensRows, expiringIn24hRows, readyForTwitchApiUsersRows] = await Promise.all([
		db.select({ count: count() }).from(tokenTable).execute(),
		db.select({ count: count() }).from(tokenTable).where(lt(tokenTable.expiresAt, now)).execute(),
		db
			.select({ count: count() })
			.from(tokenTable)
			.where(and(gt(tokenTable.expiresAt, now), lte(tokenTable.expiresAt, in24h)))
			.execute(),
		db
			.select({ count: count() })
			.from(tokenTable)
			.where(or(arrayContains(tokenTable.scope, ["channel:manage:clips"]), arrayContains(tokenTable.scope, ["editor:manage:clips"])))
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

	const [billingItems, runnerCountRows, onlineRunnerRows, runnerOwnerRows, streamCountRows, desiredRunningRows, actualRunningRows, streamErrorRows, runnersByOsRows, runnersByVersionRows] = await Promise.all([
		db.select({ subscriptionId: billingSubscriptionsTable.id, productKey: billingSubscriptionItemsTable.productKey, status: billingSubscriptionsTable.status, cancelAtPeriodEnd: billingSubscriptionsTable.cancelAtPeriodEnd, unitAmount: billingSubscriptionItemsTable.unitAmount, interval: billingSubscriptionItemsTable.billingInterval }).from(billingSubscriptionItemsTable).innerJoin(billingSubscriptionsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id)),
		db.select({ count: count() }).from(runnersTable),
		db.select({ count: count() }).from(runnersTable).where(eq(runnersTable.status, RunnerStatus.Online)),
		db.select({ count: countDistinct(runnersTable.ownerId) }).from(runnersTable),
		db.select({ count: count() }).from(streamSessionsTable),
		db.select({ count: count() }).from(streamSessionsTable).where(eq(streamSessionsTable.desiredState, StreamState.Running)),
		db.select({ count: count() }).from(streamSessionsTable).where(eq(streamSessionsTable.actualState, StreamState.Running)),
		db.select({ count: count() }).from(streamSessionsTable).where(eq(streamSessionsTable.actualState, StreamState.Error)),
		db.select({ value: runnersTable.osInfo, count: count() }).from(runnersTable).groupBy(runnersTable.osInfo),
		db.select({ value: runnersTable.version, count: count() }).from(runnersTable).groupBy(runnersTable.version),
	]);
	const activeBillingStatuses = new Set(["active", "trialing", "past_due"]);
	const runnerBillingItems = billingItems.filter((item) => item.productKey === BillingProduct.RunnerSelfHosted);
	const byOs = Object.fromEntries(runnersByOsRows.map((row) => [row.value ?? "unknown", Number(row.count ?? 0)]));
	const byVersion = Object.fromEntries(runnersByVersionRows.map((row) => [row.value ?? "unknown", Number(row.count ?? 0)]));

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
	const healthAggregationMs = Date.now() - started;

	let status: HealthStatus = "ok";
	if (dbPingMs > 2000 || healthAggregationMs > 2000 || (scheduler.totalRuns > 0 && scheduler.totalFailures / scheduler.totalRuns > 0.15)) status = "degraded";
	if (dbPingMs > 5000 || healthAggregationMs > 5000) status = "down";

	const health = {
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
		rewards: {
			overlaysWithReward: Number(overlaysWithRewardRows[0]?.count ?? 0),
			activeOverlaysWithReward: Number(activeOverlaysWithRewardRows[0]?.count ?? 0),
			uniqueRewardIds: Number(uniqueRewardIdsRows[0]?.count ?? 0),
			ownersWithReward: Number(ownersWithRewardRows[0]?.count ?? 0),
		},
		overlayConfig: {
			byType: overlayTypeCounts,
			byPlaybackMode: playbackModeCounts,
		},
		newsletter: {
			settingsRows: Number(settingsRows[0]?.count ?? 0),
			optedIn: Number(optedInRows[0]?.count ?? 0),
			optedOut: Number(optedOutRows[0]?.count ?? 0),
			consentSourceCounts,
			optedOutSourceCounts,
		},
		community: {
			totalUsers: usersTotal,
			optedInUsers: communityOptedInUsers,
			optedOutUsers: communityOptedOutUsers,
			optInRate: communityOptInRate,
		},
		queues: {
			clipQueueDepth: Number(clipQueueRows[0]?.count ?? 0),
			modQueueDepth: Number(modQueueRows[0]?.count ?? 0),
		},
		clips: {
			fetches: {
				v1GraphQL: v1GraphQLFetches,
				v2TwitchApi: v2TwitchApiFetches,
				v2FallbackGraphQL: v2FallbackGraphQLFetches,
				v2RateLimited: v2RateLimitedFetches,
			},
		},
		twitchRateLimit: {
			history: twitchRateLimitHistory,
		},
		auth: {
			tokenRows: Number(tokenRows[0]?.count ?? 0),
			expiredTokens: Number(expiredTokensRows[0]?.count ?? 0),
			expiringIn24h: Number(expiringIn24hRows[0]?.count ?? 0),
			readyForTwitchApiUsers: Number(readyForTwitchApiUsersRows[0]?.count ?? 0),
		},
		entitlements: {
			activeGrantUsers,
			activeGrantUsersOnFree,
			activeGrantCount,
			effectiveProUsersEstimate,
			grantsBySource,
			grantsByEntitlement,
		},
		billing: {
			activeSubscriptions: new Set(billingItems.filter((item) => activeBillingStatuses.has(item.status)).map((item) => item.subscriptionId)).size,
			runnerSubscriptionsActive: runnerBillingItems.filter((item) => activeBillingStatuses.has(item.status)).length,
			runnerSubscriptionsPastDue: runnerBillingItems.filter((item) => item.status === "past_due").length,
			runnerSubscriptionsCanceling: runnerBillingItems.filter((item) => item.cancelAtPeriodEnd).length,
			runnerMonthlyRecurringRevenueCents: runnerBillingItems.filter((item) => activeBillingStatuses.has(item.status) && item.interval === "month").reduce((sum, item) => sum + Number(item.unitAmount ?? 0), 0),
			runnerAnnualRecurringRevenueCents: runnerBillingItems.filter((item) => activeBillingStatuses.has(item.status)).reduce((sum, item) => sum + Number(item.unitAmount ?? 0) * (item.interval === "month" ? 12 : 1), 0),
		},
		runners: {
			total: Number(runnerCountRows[0]?.count ?? 0),
			online: Number(onlineRunnerRows[0]?.count ?? 0),
			offline: Math.max(0, Number(runnerCountRows[0]?.count ?? 0) - Number(onlineRunnerRows[0]?.count ?? 0)),
			owners: Number(runnerOwnerRows[0]?.count ?? 0),
			streamSessionsTotal: Number(streamCountRows[0]?.count ?? 0),
			streamsDesiredRunning: Number(desiredRunningRows[0]?.count ?? 0),
			streamsActuallyRunning: Number(actualRunningRows[0]?.count ?? 0),
			streamsErrored: Number(streamErrorRows[0]?.count ?? 0),
			byOs,
			byVersion,
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
			ok: dbPingMs < 5000,
			pingMs: dbPingMs,
			healthAggregationMs,
		},
	};

	if (options?.exclude) {
		for (const key of options.exclude) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			delete (health as any)[key];
		}
	}

	return health as Omit<InstanceHealthSnapshot, TExclude>;
}
