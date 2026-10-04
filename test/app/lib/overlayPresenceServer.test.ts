/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import type { PGlite as PGliteDatabase } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { fetchActiveOverlayIds, recordOverlayPresence } from "@lib/overlayPresenceServer";
import { OVERLAY_PRESENCE_TTL_MS } from "@lib/overlayPresence";

declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: PGliteDatabase;
let testDb: ReturnType<typeof drizzle>;
jest.mock("@/db/client", () => ({
	get db() {
		return testDb;
	},
}));
const report = { overlayId: "overlay-one", instanceId: "instance-one", sequence: 1, active: true };
beforeAll(async () => {
	database = new PGlite();
	testDb = drizzle(database);
	await database.exec(`CREATE TYPE twitch_cache_type AS ENUM ('user');
		CREATE TABLE "twitchCache" (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, type twitch_cache_type NOT NULL, key varchar NOT NULL, value text NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz);
		CREATE UNIQUE INDEX twitch_cache_type_key_unique ON "twitchCache" (type, key);`);
}, 30000);
beforeEach(async () => {
	await database.exec('TRUNCATE "twitchCache"');
});
afterAll(async () => {
	await database?.close();
});

it("keeps an overlay active while any instance is active", async () => {
	await recordOverlayPresence(report);
	await recordOverlayPresence({ ...report, instanceId: "preview", active: false });
	expect(await fetchActiveOverlayIds()).toEqual(new Set([report.overlayId]));
	await recordOverlayPresence({ ...report, sequence: 2, active: false });
	expect(await fetchActiveOverlayIds()).toEqual(new Set());
});
it("prevents delayed and duplicate requests from undoing a newer state", async () => {
	await recordOverlayPresence({ ...report, sequence: 2, active: false });
	await recordOverlayPresence(report);
	await recordOverlayPresence({ ...report, sequence: 2, active: true });
	expect(await fetchActiveOverlayIds()).toEqual(new Set());
	await recordOverlayPresence({ ...report, sequence: 3 });
	expect(await fetchActiveOverlayIds()).toEqual(new Set([report.overlayId]));
});
it("expires disconnected sources and ignores unrelated cache entries", async () => {
	await recordOverlayPresence(report);
	const result = await database.query<{ expires_at: Date; fetched_at: Date }>('SELECT expires_at, fetched_at FROM "twitchCache"');
	expect(new Date(result.rows[0].expires_at).getTime() - new Date(result.rows[0].fetched_at).getTime()).toBe(OVERLAY_PRESENCE_TTL_MS);
	await database.exec(`UPDATE "twitchCache" SET expires_at = now() - interval '1 second';
		INSERT INTO "twitchCache" (type, key, value, expires_at) VALUES ('user', 'unrelated', '{"overlayId":"other","active":true}', now() + interval '1 minute');`);
	expect(await fetchActiveOverlayIds()).toEqual(new Set());
});
it("ignores malformed presence entries", async () => {
	await database.exec(`INSERT INTO "twitchCache" (type, key, value, expires_at) VALUES ('user', 'overlay-presence:broken', 'invalid-json', now() + interval '1 minute');`);
	await recordOverlayPresence(report);
	expect(await fetchActiveOverlayIds()).toEqual(new Set([report.overlayId]));
});
