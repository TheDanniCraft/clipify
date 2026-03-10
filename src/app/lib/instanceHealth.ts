import { db } from "@/db/client";
import { entitlementGrantsTable, overlaysTable, usersTable, twitchCacheTable } from "@/db/schema";
import { getTwitchCacheReadMetricsSnapshot } from "@actions/database";
import { getClipCacheSchedulerStats } from "@lib/clipCacheScheduler";
import { and, eq, gt, sql } from "drizzle-orm";
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
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(table)
		.execute();
	return Number(result[0]?.count ?? 0);
}

async function countWhereOverlays(status: StatusOptions) {
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(overlaysTable)
		.where(eq(overlaysTable.status, status))
		.execute();
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
			.select({ count: sql<number>`count(*)::int` })
			.from(usersTable)
			.where(and(sql`${usersTable.lastLogin} is not null`, gt(usersTable.lastLogin, dayAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(usersTable)
			.where(and(sql`${usersTable.lastLogin} is not null`, gt(usersTable.lastLogin, weekAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(usersTable)
			.where(and(sql`${usersTable.lastLogin} is not null`, gt(usersTable.lastLogin, monthAgo)))
			.execute()
			.then((rows) => Number(rows[0]?.count ?? 0)),
	]);

	const usersByPlan = await db
		.select({
			plan: usersTable.plan,
			count: sql<number>`count(*)::int`,
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
			count: sql<number>`count(*)::int`,
		})
		.from(entitlementGrantsTable)
		.where(and(sql`${entitlementGrantsTable.startsAt} <= now()`, sql`(${entitlementGrantsTable.endsAt} is null or ${entitlementGrantsTable.endsAt} > now())`))
		.groupBy(entitlementGrantsTable.source, entitlementGrantsTable.entitlement)
		.execute();

	const activeGrantUsersResult = await db.execute(sql`select count(distinct user_id)::int as count from entitlement_grants where starts_at <= now() and (ends_at is null or ends_at > now()) and user_id is not null`);
	const activeGrantUsers = Number((activeGrantUsersResult as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);
	const activeGrantUsersOnFreeResult = await db.execute(
		sql`select count(distinct eg.user_id)::int as count
		    from entitlement_grants eg
		    join users u on u.id = eg.user_id
		    where eg.starts_at <= now()
		      and (eg.ends_at is null or eg.ends_at > now())
		      and eg.user_id is not null
		      and u.plan = ${Plan.Free}`,
	);
	const activeGrantUsersOnFree = Number((activeGrantUsersOnFreeResult as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);
	const activeGrantCount = activeGrants.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
	const effectiveProUsersEstimate = paidUsers + activeGrantUsersOnFree;

	const activeOverlayOwnersByPlanResult = await db.execute(sql`
		select u.plan as plan, count(distinct o.owner_id)::int as count
		from overlays o
		join users u on u.id = o.owner_id
		where o.status = ${StatusOptions.Active}
		group by u.plan
	`);
	const activeOverlayOwnersByPlanRows = (activeOverlayOwnersByPlanResult as { rows?: Array<{ plan?: Plan; count?: number }> }).rows ?? [];
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
			count: sql<number>`count(*)::int`,
		})
		.from(twitchCacheTable)
		.groupBy(twitchCacheTable.type)
		.execute();

	const cacheTotalEntries = cacheTotals.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
	const clipEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Clip)?.count ?? 0);
	const avatarEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Avatar)?.count ?? 0);
	const gameEntries = Number(cacheTotals.find((row) => row.type === TwitchCacheType.Game)?.count ?? 0);

	const [unavailableClipsRow, clipSyncStatesRow, clipSyncCompleteRow, staleValidatedRow] = await Promise.all([
		db.execute(sql`select count(*)::int as count from "twitchCache" where type = ${TwitchCacheType.Clip} and value like '%"unavailable":true%'`),
		db.execute(sql`select count(*)::int as count from "twitchCache" where type = ${TwitchCacheType.Clip} and key like 'clip-sync:%' and key not like 'clip-sync-force:%'`),
		db.execute(sql`select count(*)::int as count from "twitchCache" where type = ${TwitchCacheType.Clip} and key like 'clip-sync:%' and key not like 'clip-sync-force:%' and value like '%"backfillComplete":true%'`),
		db.execute(sql`select count(*)::int as count from "twitchCache" where type = ${TwitchCacheType.Clip} and key like 'clip:%' and value like '%"lastValidatedAt":%' and fetched_at < now() - interval '6 hours'`),
	]);

	const unavailableClips = Number((unavailableClipsRow as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);
	const clipSyncStates = Number((clipSyncStatesRow as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);
	const clipSyncComplete = Number((clipSyncCompleteRow as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);
	const staleValidatedClips = Number((staleValidatedRow as { rows?: Array<{ count?: number }> }).rows?.[0]?.count ?? 0);

	const scheduler = getClipCacheSchedulerStats();
	const cacheReads = await getTwitchCacheReadMetricsSnapshot();
	const dbLatencyMs = Date.now() - started;
	const backfillCompleteRatio = clipSyncStates > 0 ? clipSyncComplete / clipSyncStates : 0;

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
			clipSyncComplete,
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
