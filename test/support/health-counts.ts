import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { usersTable, overlaysTable, settingsTable, runnersTable, streamSessionsTable } from "@/db/schema";
import { account } from "@/db/auth-schema";
import { userHealthCounts, overlayHealthCounts, settingsHealthCounts, tokenHealthCounts, runnerHealthCounts, streamHealthCounts } from "@lib/health-counts";

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
