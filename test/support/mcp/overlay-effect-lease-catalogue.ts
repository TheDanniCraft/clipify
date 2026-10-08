import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";
export async function runEffectLeaseCatalogue(fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>, run: any, mode: string) {
	const calls: string[] = [];
	const sendReward = async (_creator: string, reward: string) => {
		calls.push(reward);
	};
	if (mode === "lease-replaced") {
		const second = randomUUID();
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,reward_id) VALUES($1,'creator','second-private-secret','Second','active','Featured','RewardTwo')", [second]);
		// Keep both jobs due and RewardOne first: PostgreSQL timestamps have finer precision than the worker clock.
		await fixture.pool.query("UPDATE overlay_effect_jobs SET scheduled_at=now()-interval '2 seconds' WHERE reward_id='RewardOne'");
		await fixture.pool.query("INSERT INTO overlay_effect_jobs(overlay_id,creator_id,reward_id,configuration_revision,scheduled_at) VALUES($1,'creator','RewardTwo',1,now()-interval '1 second')", [second]);
		await run({
			client: fixture.db,
			batchSize: 2,
			sendReward: async (_creator: string, reward: string) => {
				calls.push(reward);
				if (reward === "RewardOne") {
					await fixture.pool.query("UPDATE overlay_effect_jobs SET claim_expires_at=now()-interval '1 second' WHERE overlay_id=$1", [second]);
					await run({ client: fixture.db, batchSize: 1, sendReward });
				}
			},
		});
	}
	if (mode === "expired-reclaim") {
		await fixture.pool.query("UPDATE overlay_effect_jobs SET status='claimed',claimed_by=$1,claim_expires_at=now()-interval '1 second'", [randomUUID()]);
		await run({ client: fixture.db, batchSize: 1, sendReward });
	}
	if (mode === "not-due") {
		await fixture.pool.query("UPDATE overlay_effect_jobs SET scheduled_at=now()+interval '1 hour'");
		await run({ client: fixture.db, batchSize: 1, sendReward });
	}
	if (mode === "concurrent") {
		let entered!: () => void;
		let release!: () => void;
		const began = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const first = run({
			client: fixture.db,
			batchSize: 1,
			sendReward: async (_creator: string, reward: string) => {
				calls.push(reward);
				entered();
				await gate;
			},
		});
		try {
			await began;
			await run({ client: fixture.db, batchSize: 1, sendReward });
		} finally {
			release();
			await first;
		}
	}
	return { mode, calls, jobs: (await fixture.pool.query("SELECT reward_id,status,attempts,claimed_by,claim_expires_at FROM overlay_effect_jobs ORDER BY reward_id")).rows, resources: (await fixture.pool.query("SELECT configuration_revision,reward_id FROM overlays ORDER BY reward_id")).rows };
}
