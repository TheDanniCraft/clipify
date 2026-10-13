import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
function templateName(id) {
	const hash = createHash("sha256").update(id);
	for (const file of ["src/db/schema.ts", "src/db/auth-schema.ts", "test/support/mcp/postgres.ts"]) hash.update(readFileSync(file));
	return `clipify_fixture_${hash.digest("hex").slice(0, 24)}`;
}
async function ensureTemplate(admin, id, url, initialize) {
	const name = templateName(id);
	const connection = await admin.connect();
	try {
		await connection.query("SELECT pg_advisory_lock(hashtext($1))", [name]);
		const existing = await connection.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
		if (!existing.rows.length) {
			await connection.query(`CREATE DATABASE ${quote(name)}`);
			const templateUrl = new URL(url);
			templateUrl.pathname = `/${name}`;
			const seed = new Pool({ connectionString: templateUrl.href, max: 1 });
			try {
				await initialize(seed);
			} catch (error) {
				await seed.end();
				await connection.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
				throw error;
			}
			await seed.end();
			// Pool.end may resolve before PostgreSQL observes the final socket close.
			for (let attempt = 0; ; attempt++) {
				const sessions = await connection.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1", [name]);
				if (!sessions.rows[0].count) break;
				if (attempt >= 100) throw new Error("Template seed connection did not drain");
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}
		return name;
	} finally {
		await connection.query("SELECT pg_advisory_unlock(hashtext($1))", [name]);
		connection.release();
	}
}
async function cleanupTemplate() {
	const id = process.env.MCP_TEST_TEMPLATE_ID;
	if (!id) return;
	const url = new URL(process.env.MCP_TEST_DATABASE_URL ?? "postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !/^\/clipify_(mcp_fixture|e2e)$/.test(url.pathname)) throw new Error("Template cleanup requires a disposable loopback fixture");
	const pool = new Pool({ connectionString: url.href, max: 1 });
	try {
		await pool.query(`DROP DATABASE IF EXISTS ${quote(templateName(id))}`);
	} finally {
		await pool.end();
	}
}
export { ensureTemplate, cleanupTemplate, templateName };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	cleanupTemplate().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
