import { randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	const overlayId = randomUUID();
	try {
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('creator','effect@example.invalid','Effect','','user','pro')");
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,reward_id) VALUES($1,'creator','private-fixture-secret','Effect','active','Featured','RewardOne')", [overlayId]);
		const effects = await import("@/server/resources/overlay-effects");
		await fixture.db.transaction((tx) => effects.enqueueOverlayRewardEffect(tx, { overlayId, creatorId: "creator", rewardId: "RewardOne", configurationRevision: 1 }));
		const mode = process.argv[2] ?? "retry";
		if (mode === "cleared") await fixture.pool.query("UPDATE overlays SET reward_id=NULL,configuration_revision=2 WHERE id=$1", [overlayId]);
		if (mode === "changed") await fixture.pool.query("UPDATE overlays SET reward_id='RewardTwo',configuration_revision=2 WHERE id=$1", [overlayId]);
		if (mode === "name-only") await fixture.pool.query("UPDATE overlays SET name='Renamed',configuration_revision=2 WHERE id=$1", [overlayId]);
		if (mode === "deleted") await fixture.pool.query("DELETE FROM overlays WHERE id=$1", [overlayId]);
		const run = (effects as any).runOverlayRewardEffects;
		const snapshot = async () => ({ jobs: (await fixture.pool.query("SELECT status,attempts,last_error,claimed_by,claim_expires_at FROM overlay_effect_jobs ORDER BY created_at,id")).rows, resources: (await fixture.pool.query("SELECT configuration_revision,reward_id FROM overlays WHERE id=$1", [overlayId])).rows });
		if (["lease-replaced", "expired-reclaim", "not-due", "concurrent"].includes(mode)) {
			console.log(JSON.stringify(await (await import("./overlay-effect-lease-catalogue")).runEffectLeaseCatalogue(fixture, run, mode)));
			return;
		}
		if (mode !== "retry") {
			let calls = 0;
			if (typeof run === "function")
				await run({
					client: fixture.db,
					now: new Date(),
					batchSize: 1,
					sendReward: async () => {
						calls++;
					},
				});
			console.log(JSON.stringify({ available: typeof run === "function", mode, calls, state: await snapshot() }));
			return;
		}
		let calls = 0;
		let outsideResourceLock = false;
		const now = new Date();
		if (typeof run === "function") {
			await run({
				client: fixture.db,
				now,
				batchSize: 1,
				sendReward: async () => {
					calls++;
					const connection = await fixture.pool.connect();
					try {
						await connection.query("BEGIN");
						await connection.query("SELECT id FROM overlays WHERE id=$1 FOR UPDATE NOWAIT", [overlayId]);
						outsideResourceLock = true;
					} finally {
						await connection.query("ROLLBACK");
						connection.release();
					}
					throw new Error("controlled provider failure");
				},
			});
		}
		const afterFailure = await snapshot();
		if (typeof run === "function")
			await run({
				client: fixture.db,
				now,
				batchSize: 1,
				sendReward: async () => {
					calls++;
				},
			});
		const earlyCalls = calls;
		if (typeof run === "function")
			await run({
				client: fixture.db,
				now: new Date(now.getTime() + 3600000),
				batchSize: 1,
				sendReward: async () => {
					calls++;
				},
			});
		console.log(JSON.stringify({ available: typeof run === "function", calls, earlyCalls, outsideResourceLock, afterFailure, afterRetry: await snapshot() }));
	} finally {
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
