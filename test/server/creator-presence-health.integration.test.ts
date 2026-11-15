/** @jest-environment node */
import { createMcpPostgresFixture } from "../support/mcp/postgres";
import { getCreatorPresenceHealth } from "@/server/creator-presence-health";
import { addSubscriber, ownerSubscribers, overlaySubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";
import { COMMUNITY_SNAPSHOT_CACHE_KEY } from "@/app/lib/community-presence-contract";

jest.setTimeout(60000);
const now = new Date("2026-11-15T12:00:00Z");
const snapshot = () => ({
	updatedAt: now.toISOString(),
	totalCount: 4,
	liveStatusKnownCount: 3,
	streamers: [
		{ id: "live", status: "live" },
		{ id: "live-two", status: "live_with_overlay" },
		{ id: "offline", status: "offline" },
		{ id: "unknown", status: "offline" },
	],
});
afterEach(() => {
	ownerSubscribers.clear();
	overlaySubscribers.clear();
});

test("counts confirmed Twitch states and distinct active player owners without exposing identities", async () => {
	const fixture = await createMcpPostgresFixture();
	try {
		await fixture.pool.query("INSERT INTO \"twitchCache\"(type,key,value,expires_at) VALUES('user',$1,$2,$3)", [COMMUNITY_SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot()), new Date(now.getTime() + 120000)]);
		const source = { role: "overlay", readyState: 1, sourceActive: true } as never;
		addSubscriber("live", "one", source);
		addSubscriber("live", "two", { role: "overlay", readyState: 1, sourceActive: true } as never);
		addSubscriber("offline", "three", source);
		for (const client of [
			{ role: "controller", readyState: 1, sourceActive: true },
			{ role: "overlay", readyState: 3, sourceActive: true },
			{ role: "overlay", readyState: 1, sourceActive: false },
		])
			addSubscriber("live-two", "ignored", client as never);
		const result = await getCreatorPresenceHealth(fixture.db, 4, now);
		expect(result).toEqual({ twitchOnline: 2, twitchOffline: 1, twitchUnknown: 1, twitchSnapshotFresh: 1, twitchSnapshotAgeSeconds: 0, connectedCreators: 2, onlineUsingClipify: 1 });
		expect(Object.values(result).every((value) => value === null || typeof value === "number")).toBe(true);
		removeSubscriber("offline", "three", source);
		expect((await getCreatorPresenceHealth(fixture.db, 4, now)).connectedCreators).toBe(1);
		await fixture.pool.query('UPDATE "twitchCache" SET value=$1', [JSON.stringify({ ...snapshot(), totalCount: 0, liveStatusKnownCount: 0, streamers: [] })]);
		expect(await getCreatorPresenceHealth(fixture.db, 0, now)).toMatchObject({ twitchOnline: 0, twitchOffline: 0, twitchUnknown: 0, twitchSnapshotFresh: 1, onlineUsingClipify: 0 });
	} finally {
		await fixture.close();
	}
});

test("missing, stale, expired, legacy and malformed Twitch observations report unknown instead of offline", async () => {
	const fixture = await createMcpPostgresFixture();
	try {
		expect(await getCreatorPresenceHealth(fixture.db, 7, now)).toMatchObject({ twitchOnline: null, twitchOffline: null, twitchUnknown: 7, twitchSnapshotFresh: 0, twitchSnapshotAgeSeconds: null, onlineUsingClipify: null });
		for (const [name, value, expiresAt] of [
			["stale", { ...snapshot(), updatedAt: new Date(now.getTime() - 120000).toISOString() }, new Date(now.getTime() + 1000)],
			["expired", snapshot(), now],
			["missing expiry", snapshot(), null],
			["future", { ...snapshot(), updatedAt: new Date(now.getTime() + 1000).toISOString() }, new Date(now.getTime() + 1000)],
			["legacy", { ...snapshot(), liveStatusKnownCount: undefined }, new Date(now.getTime() + 1000)],
			["duplicate creator", { ...snapshot(), streamers: [snapshot().streamers[0], snapshot().streamers[0], ...snapshot().streamers.slice(2)] }, new Date(now.getTime() + 1000)],
			["wrong total", { ...snapshot(), totalCount: 5 }, new Date(now.getTime() + 1000)],
			["invalid known count", { ...snapshot(), liveStatusKnownCount: 1 }, new Date(now.getTime() + 1000)],
			["excess known count", { ...snapshot(), liveStatusKnownCount: 5 }, new Date(now.getTime() + 1000)],
			["invalid JSON", "{", new Date(now.getTime() + 1000)],
		] as const) {
			await fixture.pool.query("INSERT INTO \"twitchCache\"(type,key,value,expires_at) VALUES('user',$1,$2,$3) ON CONFLICT(type,key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at", [COMMUNITY_SNAPSHOT_CACHE_KEY, typeof value === "string" ? value : JSON.stringify(value), expiresAt]);
			const result = await getCreatorPresenceHealth(fixture.db, 7, now);
			expect({ name, online: result.twitchOnline, offline: result.twitchOffline, unknown: result.twitchUnknown, fresh: result.twitchSnapshotFresh }).toEqual({ name, online: null, offline: null, unknown: 7, fresh: 0 });
		}
		await fixture.pool.query('UPDATE "twitchCache" SET value=$1,expires_at=$2', [JSON.stringify({ ...snapshot(), liveStatusKnownCount: 0, streamers: snapshot().streamers.map((streamer) => ({ ...streamer, status: "offline" })) }), new Date(now.getTime() + 1000)]);
		expect(await getCreatorPresenceHealth(fixture.db, 4, now)).toMatchObject({ twitchOnline: 0, twitchOffline: 0, twitchUnknown: 4, twitchSnapshotFresh: 1 });
	} finally {
		await fixture.close();
	}
});
