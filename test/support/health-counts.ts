import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, inArray } from "drizzle-orm";
import { usersTable, overlaysTable, settingsTable, runnersTable, streamSessionsTable, clipCrawlJobsTable, notificationOutboxTable, twitchCacheTable } from "@/db/schema";
import { account } from "@/db/auth-schema";
import { userHealthCounts, overlayHealthCounts, settingsHealthCounts, tokenHealthCounts, runnerHealthCounts, streamHealthCounts, crawlerHealthCounts, notificationHealthCounts, cacheHealthCounts } from "@lib/health-counts";

let postgres: PGlite;
const now = new Date("2026-10-09T12:00:00Z");
const in24h = new Date("2026-10-10T12:00:00Z");
const dates = [new Date("2026-10-08T12:00:00Z"), new Date("2026-10-02T12:00:00Z"), new Date("2026-09-09T12:00:00Z")] as const;

before(async () => {
	postgres = new PGlite();
	await postgres.exec(`
	CREATE TABLE users (last_login timestamptz, disabled boolean, disable_type text);
	CREATE TABLE overlays (status text, playlist_id uuid, reward_id text, owner_id text);
	CREATE TABLE runners (status text, owner_id text);
	CREATE TABLE stream_sessions (desired_state text, actual_state text);
	CREATE TABLE "userSettings" (marketing_opt_in boolean, show_in_community boolean);
	CREATE SCHEMA auth;
	CREATE TABLE auth.account (provider_id text, access_token_expires_at timestamp, scope text);
	`);
});

after(async () => {
	await postgres.close();
});

test("empty aggregate tables return zero rather than null", async () => {
	const db = drizzle(postgres);
	const [users] = await db.select(userHealthCounts(...dates)).from(usersTable);
	const [overlays] = await db.select(overlayHealthCounts()).from(overlaysTable);
	const [settings] = await db.select(settingsHealthCounts()).from(settingsTable);
	const [tokens] = await db.select(tokenHealthCounts(now, in24h)).from(account).where(eq(account.providerId, "twitch"));
	const [runners] = await db.select(runnerHealthCounts()).from(runnersTable);
	const [streams] = await db.select(streamHealthCounts()).from(streamSessionsTable);
	for (const aggregate of [users, overlays, settings, tokens, runners, streams]) {
		for (const value of Object.values(aggregate)) assert.equal(Number(value), 0);
	}
});

test("combined queries preserve null, boolean and exact time-boundary semantics", async () => {
	await postgres.exec(`
	INSERT INTO users VALUES
	('2026-10-09T11:00:00Z', false, NULL),
	('2026-10-08T12:00:00Z', true, 'manual'),
	('2026-10-02T12:00:00Z', true, 'automatic'),
	('2026-09-09T12:00:00Z', false, 'manual'),
	(NULL, true, NULL);
	INSERT INTO overlays VALUES
	('active', '00000000-0000-0000-0000-000000000001', 'reward-1', 'owner-1'),
	('paused', NULL, 'reward-1', 'owner-1'),
	('active', NULL, NULL, 'owner-2');
	INSERT INTO runners VALUES ('online', 'owner-1'), ('offline','owner-1'), ('offline','owner-2');
	INSERT INTO stream_sessions VALUES ('running','running'), ('running','error'), ('stopped','stopped');
	INSERT INTO "userSettings" VALUES (true,true), (false,false), (NULL,NULL);
	INSERT INTO auth.account VALUES
	('twitch','2026-10-09T11:00:00Z','channel:manage:clips'),
	('twitch','2026-10-09T12:00:00Z','notchannel:manage:clips'),
	('twitch','2026-10-10T12:00:00Z','user:read:email editor:manage:clips'),
	('twitch',NULL,NULL),
	('other','2026-10-09T11:00:00Z','channel:manage:clips');
	`);
	const db = drizzle(postgres);
	const [users] = await db.select(userHealthCounts(...dates)).from(usersTable);
	const [overlays] = await db.select(overlayHealthCounts()).from(overlaysTable);
	const [settings] = await db.select(settingsHealthCounts()).from(settingsTable);
	const [tokens] = await db.select(tokenHealthCounts(now, in24h)).from(account).where(eq(account.providerId, "twitch"));
	const numeric = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).map(([key, count]) => [key, Number(count)]));
	assert.deepEqual(numeric(users), { total: 5, active24h: 1, active7d: 2, active30d: 3, disabled: 3, manual: 1, automatic: 1, neverLoggedIn: 1 });
	assert.deepEqual(numeric(overlays), { total: 3, active: 2, paused: 1, withPlaylist: 1, activeWithPlaylist: 1, withReward: 2, activeWithReward: 1, uniqueRewards: 1, rewardOwners: 1 });
	assert.deepEqual(numeric(settings), { total: 3, optedIn: 1, optedOut: 1, community: 1 });
	assert.deepEqual(numeric(tokens), { total: 4, expired: 1, expiring: 1, ready: 2 });
	// A subsequent poll sees new rows immediately: there is no aggregate cache.
	await postgres.exec("INSERT INTO overlays VALUES ('active', NULL, NULL, 'owner-3')");
	const [fresh] = await db.select(overlayHealthCounts()).from(overlaysTable);
	assert.deepEqual(numeric(fresh), { total: 4, active: 3, paused: 1, withPlaylist: 1, activeWithPlaylist: 1, withReward: 2, activeWithReward: 1, uniqueRewards: 1, rewardOwners: 1 });
	const [runners] = await db.select(runnerHealthCounts()).from(runnersTable);
	const [streams] = await db.select(streamHealthCounts()).from(streamSessionsTable);
	assert.deepEqual(numeric(runners), { total: 3, online: 1, owners: 2 });
	assert.deepEqual(numeric(streams), { total: 3, desiredRunning: 2, actualRunning: 1, errors: 1 });
});

test("download permission coverage accepts native comma and migrated whitespace lists with exact token boundaries", async () => {
	await postgres.exec(`TRUNCATE auth.account;
	 INSERT INTO auth.account VALUES
	 ('twitch',NULL,'openid,user:read:email,channel:manage:clips'),
	 ('twitch',NULL,'openid, editor:manage:clips ,user:read:email'),
	 ('twitch',NULL,E'user:read:email\\tchannel:manage:clips'),
	 ('twitch',NULL,'notchannel:manage:clips'),
	 ('twitch',NULL,'channel:manage:clips:extra'),
	 ('twitch',NULL,NULL);`);
	const [counts] = await drizzle(postgres).select(tokenHealthCounts(now, in24h)).from(account).where(eq(account.providerId, "twitch"));
	assert.equal(Number(counts.ready), 3);
});

test("queue health excludes disabled creators and sent history, distinguishes retries, skips and exact lease boundaries, and stays fresh", async () => {
	await postgres.exec(`
	 ALTER TABLE users ADD COLUMN id text;
	 TRUNCATE users;
	 INSERT INTO users(id,disabled) VALUES ('a',false),('b',true),('c',false),('d',false);
	 CREATE TABLE clip_crawl_jobs (creator_id text,kind text,next_run_at timestamptz,requested_at timestamptz,lease_expires_at timestamptz,failures integer);
	 INSERT INTO clip_crawl_jobs VALUES
	 ('a','recent','2026-10-09T11:50:00Z','2026-10-09T11:52:00Z',NULL,0),
	 ('a','backfill','2026-10-09T11:40:00Z',NULL,'2026-10-09T12:00:00Z',1),
	 ('b','recent','2026-10-09T11:00:00Z','2026-10-09T11:00:00Z',NULL,0),
	 ('c','recent','2026-10-09T11:59:00Z',NULL,'2026-10-09T12:02:00Z',0),
	 ('c','backfill','2026-10-09T12:03:00Z',NULL,NULL,2),
	 ('d','recent','2026-10-09T12:05:00Z',NULL,NULL,0),
	 ('d','backfill',NULL,NULL,NULL,0);
	 CREATE TABLE notification_outbox (status text,scheduled_at timestamptz,claim_expires_at timestamptz,last_error text);
	 INSERT INTO notification_outbox VALUES
	 ('pending','2026-10-09T11:59:00Z',NULL,NULL),
	 ('pending','2026-10-09T11:55:00Z',NULL,NULL),
	 ('retry','2026-10-09T11:58:00Z',NULL,'temporary'),
	 ('pending','2026-10-09T12:01:00Z',NULL,NULL),
	 ('retry','2026-10-09T12:02:00Z',NULL,'temporary'),
	 ('claimed','2026-10-09T11:59:00Z','2026-10-09T12:01:00Z',NULL),
	 ('claimed','2026-10-09T11:59:00Z','2026-10-09T12:00:00Z',NULL),
	 ('dead','2026-10-09T11:59:00Z',NULL,'NOTIFICATION_NO_LONGER_APPLIES'),
	 ('dead','2026-10-09T11:59:00Z',NULL,'provider rejected'),
	 ('sent','2026-10-09T11:00:00Z',NULL,NULL);
	`);
	const db = drizzle(postgres);
	const [crawler] = await db.select(crawlerHealthCounts(now)).from(clipCrawlJobsTable).innerJoin(usersTable, eq(usersTable.id, clipCrawlJobsTable.creatorId)).where(eq(usersTable.disabled, false));
	const numeric = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
	assert.deepEqual(numeric(crawler), { dueRecent: 1, dueBackfill: 1, runningRecent: 1, runningBackfill: 0, manualPending: 1, scheduled: 1, retrying: 2, expiredLeases: 1, oldestDueAgeSeconds: 1200, oldestManualWaitSeconds: 480 });
	const readOutbox = async () => {
		const [row] = await db
			.select(notificationHealthCounts(now))
			.from(notificationOutboxTable)
			.where(inArray(notificationOutboxTable.status, ["pending", "retry", "claimed", "dead"]));
		return numeric(row);
	};
	assert.deepEqual(await readOutbox(), { duePending: 2, dueRetry: 1, scheduledPending: 1, scheduledRetry: 1, claimed: 1, expiredClaims: 1, failed: 1, skipped: 1, oldestDueAgeSeconds: 300 });
	await postgres.exec("UPDATE notification_outbox SET scheduled_at='2026-10-09T12:01:00Z' WHERE scheduled_at='2026-10-09T11:55:00Z'");
	assert.equal((await readOutbox()).duePending, 1);
	assert.equal((await readOutbox()).oldestDueAgeSeconds, 120);
});

test("cache totals, unavailable and stale validation counts share one scan with exact boundaries", async () => {
	await postgres.exec(`CREATE TABLE "twitchCache" (type text, key text, value text, fetched_at timestamptz);
 INSERT INTO "twitchCache" VALUES
 ('clip','clip:old','{"unavailable":true,"lastValidatedAt":null}','2026-10-09T05:59:59Z'),
 ('clip','clip:boundary','{"lastValidatedAt":"yes"}','2026-10-09T06:00:00Z'),
 ('clip','clip:fresh','{"unavailable":false,"lastValidatedAt":"yes"}','2026-10-09T11:00:00Z'),
 ('clip','clip:unchecked','{}','2026-10-09T01:00:00Z'),
 ('clip','clip-sync:owner','{"unavailable":true,"lastValidatedAt":"yes"}','2026-10-09T01:00:00Z'),
 ('avatar','avatar:owner','{}','2026-10-09T01:00:00Z'),
 ('game','game:one',NULL,NULL);
 `);
	const db = drizzle(postgres);
	const read = async () =>
		(
			await db
				.select({ type: twitchCacheTable.type, ...cacheHealthCounts(now) })
				.from(twitchCacheTable)
				.groupBy(twitchCacheTable.type)
		)
			.map((row) => ({ ...row, count: Number(row.count), unavailable: Number(row.unavailable), staleValidated: Number(row.staleValidated) }))
			.sort((a, b) => a.type.localeCompare(b.type));
	assert.deepEqual(await read(), [
		{ type: "avatar", count: 1, unavailable: 0, staleValidated: 0 },
		{ type: "clip", count: 5, unavailable: 2, staleValidated: 1 },
		{ type: "game", count: 1, unavailable: 0, staleValidated: 0 },
	]);
	await postgres.exec(`UPDATE "twitchCache" SET fetched_at='2026-10-09T11:00:00Z' WHERE key='clip:old'`);
	assert.equal((await read()).find((row) => row.type === "clip")?.staleValidated, 0);
	await postgres.exec('TRUNCATE "twitchCache"');
	assert.deepEqual(await read(), []);
});
