import { count, countDistinct, sql } from "drizzle-orm";
import { usersTable, overlaysTable, settingsTable, runnersTable, streamSessionsTable } from "@/db/schema";
import { account as authAccountTable } from "@/db/auth-schema";
import { StatusOptions, RunnerStatus, StreamState } from "@types";

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
		ready: sql<number>`count(*) filter (where ${authAccountTable.scope} ~ '(^| )(channel:manage:clips|editor:manage:clips)( |$)')`,
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
