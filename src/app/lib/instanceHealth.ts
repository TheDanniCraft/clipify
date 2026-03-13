import { db } from "@/db/client";
import { entitlementGrantsTable, overlaysTable, usersTable, twitchCacheTable } from "@/db/schema";
import { getTwitchCacheReadMetricsSnapshot } from "@actions/database";
import { getClipCacheSchedulerStats } from "@lib/clipCacheScheduler";
import { and, count, countDistinct, desc, eq, gt, isNotNull, isNull, like, lt, lte, notLike, or, sql } from "drizzle-orm";
import { Entitlement, EntitlementGrantSource, Plan, StatusOptions, TwitchCacheType } from "@types";
import { TWITCH_CLIPS_LAUNCH_MS } from "@lib/constants";

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

async function countRows(table: typeof usersTable | typeof overlaysTable) {
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
	const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const [usersTotal, overlaysTotal, overlaysActive, overlaysPaused, activeUsers24h, activeUsers7d, activeUsers30d] = await Promise.all([
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
	]);

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
		.where(
			and(
				lte(entitlementGrantsTable.startsAt, sql`now()`),
				or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, sql`now()`)),
				isNotNull(entitlementGrantsTable.userId),
				eq(usersTable.plan, Plan.Free),
			),
		)
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

	const [unavailableClipsRows, clipSyncStatesRows, staleValidatedRows] = await Promise.all([
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.value, '%"unavailable":true%')))
			.execute(),
		db
			.select({ key: twitchCacheTable.key, value: twitchCacheTable.value })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), like(twitchCacheTable.key, "clip-sync:%"), notLike(twitchCacheTable.key, "clip-sync-force:%")))
			.orderBy(desc(twitchCacheTable.fetchedAt))
			.execute(),
		db
			.select({ count: count() })
			.from(twitchCacheTable)
			.where(
				and(
					eq(twitchCacheTable.type, TwitchCacheType.Clip),
					like(twitchCacheTable.key, "clip:%"),
					like(twitchCacheTable.value, '%"lastValidatedAt":%'),
					lt(twitchCacheTable.fetchedAt, sql`now() - interval '6 hours'`),
				),
			)
			.execute(),
	]);

	const unavailableClips = Number(unavailableClipsRows[0]?.count ?? 0);
	const staleValidatedClips = Number(staleValidatedRows[0]?.count ?? 0);

	const syncStatesRaw = clipSyncStatesRows;
	const clipSyncStates = syncStatesRaw.length;

	// Calculate the global % ratio based on user timestamps
	const NOW_MS = Date.now();

	let totalProgress = 0;
	let clipSyncCompleteCount = 0;

	for (const row of syncStatesRaw) {
		try {
			const state = JSON.parse(row.value);
			const totalDuration = NOW_MS - TWITCH_CLIPS_LAUNCH_MS;

			if (state.backfillComplete) {
				totalProgress += 1; // 100% complete
				clipSyncCompleteCount += 1;
			} else if (state.backfillWindowEnd) {
				const endMs = new Date(state.backfillWindowEnd).getTime();
				if (Number.isFinite(endMs) && totalDuration > 0) {
					const effectiveEndMs = Math.min(endMs, NOW_MS);
					const progress = (NOW_MS - effectiveEndMs) / totalDuration;
					totalProgress += Math.max(0, Math.min(1, progress));
				}
			}
		} catch {
			// Ignore malformed JSON
		}
	}

	const backfillCompleteRatio = clipSyncStates > 0 ? totalProgress / clipSyncStates : 0;

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
