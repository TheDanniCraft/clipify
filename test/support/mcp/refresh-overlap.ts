import type { Pool } from "pg";
/** Hold the actual token row until both native rotation statements wait on it. */
export async function runOverlappingRefresh(pool: Pool, refresh: () => Promise<Response>) {
	const blocker = await pool.connect();
	let responses: Promise<Response[]> | undefined;
	let waiting = 0;
	try {
		await blocker.query("BEGIN");
		await blocker.query("SELECT id FROM auth.oauth_refresh_token WHERE revoked IS NULL FOR UPDATE");
		responses = Promise.all([refresh(), refresh()]);
		const deadline = performance.now() + 3000;
		while (performance.now() < deadline) {
			waiting = Number((await pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query ILIKE '%update%oauth_refresh_token%'")).rows[0].count);
			if (waiting === 2) break;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		await blocker.query("COMMIT");
		const result = await responses;
		if (waiting !== 2) throw new Error("Two native refresh statements did not overlap at token row lock");
		return { responses: result, waiting };
	} finally {
		await blocker.query("ROLLBACK").catch(() => {});
		blocker.release();
		await responses;
	}
}
