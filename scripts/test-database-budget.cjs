/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require("pg");

function selectDatabaseWorkers(workers, capacity) {
	if (!capacity || !["max_connections", "reserved_connections", "active_connections"].every((key) => Number.isSafeInteger(capacity[key]) && capacity[key] >= 0) || capacity.max_connections < 1) return 1;
	// Leave slots for the shared Next server/control work; quiet high-concurrency
	// proofs run later, while ordinary fixtures get a conservative per-suite budget.
	const available = capacity.max_connections - capacity.reserved_connections - capacity.active_connections - 16;
	return Math.max(1, Math.min(workers, 4, Math.floor(available / 16)));
}

async function readFixtureDatabaseCapacity() {
	let url;
	try {
		url = new URL(process.env.MCP_TEST_DATABASE_URL ?? "postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture");
		if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !/^\/clipify_(mcp_fixture|e2e)$/.test(url.pathname)) return undefined;
	} catch {
		return undefined;
	}
	const pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1000, query_timeout: 1000 });
	try {
		const result = await pool.query("SELECT current_setting('max_connections')::int AS max_connections, current_setting('superuser_reserved_connections')::int + COALESCE(current_setting('reserved_connections',true),'0')::int AS reserved_connections, (SELECT count(*)::int FROM pg_stat_activity) AS active_connections");
		return result.rows[0];
	} catch {
		return undefined;
	} finally {
		await pool.end();
	}
}
module.exports = { selectDatabaseWorkers, readFixtureDatabaseCapacity };
