import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	let release!: () => void;
	const barrier = new Promise<void>((resolve) => {
		release = resolve;
	});
	try {
		const { dbPool } = await import("@/db/client");
		const { withSerializedProviderCredential } = await import("@/server/provider-credentials");
		dbPool.options.max = 3;
		let entered = 0;
		let queuedRuns = 0;
		const holders = ["holder-a", "holder-b"].map((id) =>
			withSerializedProviderCredential(dbPool, id, async () => {
				entered++;
				await barrier;
				return "held";
			}),
		);
		const setupDeadline = performance.now() + 2000;
		while (entered !== 2 && performance.now() < setupDeadline) await new Promise((resolve) => setTimeout(resolve, 5));
		if (entered !== 2) throw new Error("Native holders failed to acquire capacity");
		const started = performance.now();
		let error = "";
		try {
			await withSerializedProviderCredential(dbPool, "queued", async () => {
				queuedRuns++;
			});
		} catch (caught) {
			error = caught instanceof Error ? caught.message : "unexpected";
		}
		const elapsed = performance.now() - started;
		const healthyWhileHeld = (await dbPool.query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		release();
		await Promise.all(holders);
		const retry = await withSerializedProviderCredential(dbPool, "queued", async () => "retry-ok");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const observer = await fixture.pool.connect();
		let allLocksReleased = true;
		for (const id of ["holder-a", "holder-b", "queued"]) {
			const locked = (await observer.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired", [`clipify:twitch:${id}`])).rows[0].acquired;
			allLocksReleased &&= locked;
			if (locked) await observer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`clipify:twitch:${id}`]);
		}
		observer.release();
		console.log(JSON.stringify({ elapsed, error, queuedRuns, retry, healthyWhileHeld, allLocksReleased }));
	} finally {
		release?.();
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
