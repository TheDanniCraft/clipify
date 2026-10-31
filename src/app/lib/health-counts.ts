import { count, countDistinct, sql } from "drizzle-orm";
import { usersTable, overlaysTable, settingsTable, runnersTable, streamSessionsTable, clipCrawlJobsTable, notificationOutboxTable, twitchCacheTable } from "@/db/schema";
import { account as authAccountTable } from "@/db/auth-schema";
import { StatusOptions, RunnerStatus, StreamState, TwitchCacheType } from "@types";

// Multiple filtered counts share a query while preserving fresh values on every poll.
export function userHealthCounts(dayAgo: Date, weekAgo: Date, monthAgo: Date) {
	return {
		total: count(),
		active24h: sql<number>`count(*) filter (where ${usersTable.lastLogin} > ${dayAgo})`,
		active7d: sql<number>`count(*) filter (where ${usersTable.lastLogin} > ${weekAgo})`,
		active30d: sql<number>`count(*) filter (where ${usersTable.lastLogin} > ${monthAgo})`,
		disabled: sql<number>`count(*) filter (where ${usersTable.disabled} = true)`,
		manual: sql<number>`count(*) filter (where ${usersTable.disabled} = true and ${usersTable.disableType} = 'manual')`,
		automatic: sql<number>`count(*) filter (where ${usersTable.disabled} = true and ${usersTable.disableType} = 'automatic')`,
		neverLoggedIn: sql<number>`count(*) filter (where ${usersTable.lastLogin} is null)`,
	};
}

export function overlayHealthCounts() {
	return {
		total: count(),
		active: sql<number>`count(*) filter (where ${overlaysTable.status} = ${StatusOptions.Active})`,
		paused: sql<number>`count(*) filter (where ${overlaysTable.status} = ${StatusOptions.Paused})`,
		withPlaylist: sql<number>`count(*) filter (where ${overlaysTable.playlistId} is not null)`,
		activeWithPlaylist: sql<number>`count(*) filter (where ${overlaysTable.playlistId} is not null and ${overlaysTable.status} = ${StatusOptions.Active})`,
		withReward: sql<number>`count(*) filter (where ${overlaysTable.rewardId} is not null)`,
		activeWithReward: sql<number>`count(*) filter (where ${overlaysTable.rewardId} is not null and ${overlaysTable.status} = ${StatusOptions.Active})`,
		uniqueRewards: countDistinct(overlaysTable.rewardId),
		rewardOwners: sql<number>`count(distinct ${overlaysTable.ownerId}) filter (where ${overlaysTable.rewardId} is not null)`,
	};
}

export function settingsHealthCounts() {
	return {
		total: count(),
		optedIn: sql<number>`count(*) filter (where ${settingsTable.marketingOptIn} = true)`,
		optedOut: sql<number>`count(*) filter (where ${settingsTable.marketingOptIn} = false)`,
		community: sql<number>`count(*) filter (where ${settingsTable.showOnCommunityPage} = true)`,
	};
}

export function tokenHealthCounts(now: Date, in24h: Date) {
	return {
		total: count(),
		expired: sql<number>`count(*) filter (where ${authAccountTable.accessTokenExpiresAt} < ${now})`,
		expiring: sql<number>`count(*) filter (where ${authAccountTable.accessTokenExpiresAt} > ${now} and ${authAccountTable.accessTokenExpiresAt} <= ${in24h})`,
		ready: sql<number>`count(*) filter (where ${authAccountTable.scope} ~ '(^|[[:space:],])(channel:manage:clips|editor:manage:clips)([[:space:],]|$)')`,
	};
}

/** One fresh aggregate over the same enabled-creator queue the workers claim. */
export function crawlerHealthCounts(now: Date) {
	const jobs = clipCrawlJobsTable;
	const sampledAt = sql`${now.toISOString()}::timestamptz`;
	const running = sql`${jobs.leaseExpiresAt} > ${sampledAt}`;
	const available = sql`(${jobs.leaseExpiresAt} IS NULL OR ${jobs.leaseExpiresAt} <= ${sampledAt})`;
	const due = sql`${jobs.nextRunAt} <= ${sampledAt} AND ${available}`;
	const manual = sql`${jobs.requestedAt} IS NOT NULL AND ${jobs.nextRunAt} IS NOT NULL AND ${available}`;
	return {
		dueRecent: sql<number>`count(*) filter (where ${due} AND ${jobs.kind} = 'recent')`,
		dueBackfill: sql<number>`count(*) filter (where ${due} AND ${jobs.kind} = 'backfill')`,
		runningRecent: sql<number>`count(*) filter (where ${running} AND ${jobs.kind} = 'recent')`,
		runningBackfill: sql<number>`count(*) filter (where ${running} AND ${jobs.kind} = 'backfill')`,
		manualPending: sql<number>`count(*) filter (where ${manual})`,
		scheduled: sql<number>`count(*) filter (where ${jobs.nextRunAt} > ${sampledAt} AND ${available} AND ${jobs.failures} = 0)`,
		retrying: sql<number>`count(*) filter (where ${jobs.failures} > 0 AND ${jobs.nextRunAt} IS NOT NULL AND ${available})`,
		expiredLeases: sql<number>`count(*) filter (where ${jobs.leaseExpiresAt} <= ${sampledAt})`,
		oldestDueAgeSeconds: sql<number>`coalesce(greatest(extract(epoch FROM (${sampledAt} - min(${jobs.nextRunAt}) filter (where ${due}))), 0), 0)`,
		oldestManualWaitSeconds: sql<number>`coalesce(greatest(extract(epoch FROM (${sampledAt} - min(${jobs.requestedAt}) filter (where ${manual}))), 0), 0)`,
	};
}

/** Caller excludes sent history; deliberately discarded notices are not delivery failures. */
export function notificationHealthCounts(now: Date) {
	const outbox = notificationOutboxTable;
	const sampledAt = sql`${now.toISOString()}::timestamptz`;
	const due = sql`${outbox.scheduledAt} <= ${sampledAt}`;
	return {
		duePending: sql<number>`count(*) filter (where ${outbox.status} = 'pending' AND ${due})`,
		dueRetry: sql<number>`count(*) filter (where ${outbox.status} = 'retry' AND ${due})`,
		scheduledPending: sql<number>`count(*) filter (where ${outbox.status} = 'pending' AND ${outbox.scheduledAt} > ${sampledAt})`,
		scheduledRetry: sql<number>`count(*) filter (where ${outbox.status} = 'retry' AND ${outbox.scheduledAt} > ${sampledAt})`,
		claimed: sql<number>`count(*) filter (where ${outbox.status} = 'claimed' AND ${outbox.claimExpiresAt} > ${sampledAt})`,
		expiredClaims: sql<number>`count(*) filter (where ${outbox.status} = 'claimed' AND (${outbox.claimExpiresAt} IS NULL OR ${outbox.claimExpiresAt} <= ${sampledAt}))`,
		failed: sql<number>`count(*) filter (where ${outbox.status} = 'dead' AND ${outbox.lastError} IS DISTINCT FROM 'NOTIFICATION_NO_LONGER_APPLIES')`,
		skipped: sql<number>`count(*) filter (where ${outbox.status} = 'dead' AND ${outbox.lastError} = 'NOTIFICATION_NO_LONGER_APPLIES')`,
		oldestDueAgeSeconds: sql<number>`coalesce(greatest(extract(epoch FROM (${sampledAt} - min(${outbox.scheduledAt}) filter (where ${outbox.status} IN ('pending', 'retry') AND ${due}))), 0), 0)`,
	};
}

export function runnerHealthCounts() {
	return {
		total: count(),
		online: sql<number>`count(*) filter (where ${runnersTable.status} = ${RunnerStatus.Online})`,
		owners: countDistinct(runnersTable.ownerId),
	};
}
export function streamHealthCounts() {
	return {
		total: count(),
		desiredRunning: sql<number>`count(*) filter (where ${streamSessionsTable.desiredState} = ${StreamState.Running})`,
		actualRunning: sql<number>`count(*) filter (where ${streamSessionsTable.actualState} = ${StreamState.Running})`,
		errors: sql<number>`count(*) filter (where ${streamSessionsTable.actualState} = ${StreamState.Error})`,
	};
}

export function cacheHealthCounts(now: Date) {
	const cache = twitchCacheTable;
	return {
		count: count(),
		unavailable: sql<number>`count(*) filter (where ${cache.type} = ${TwitchCacheType.Clip} and coalesce((${cache.value}::jsonb ->> 'unavailable')::boolean, false))`,
		staleValidated: sql<number>`count(*) filter (where ${cache.type} = ${TwitchCacheType.Clip} and ${cache.key} like 'clip:%' and ${cache.value}::jsonb ? 'lastValidatedAt' and ${cache.fetchedAt} < ${now.toISOString()}::timestamptz - interval '6 hours')`,
	};
}
