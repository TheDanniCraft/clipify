import { randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
import { templateName, cleanupTemplate } from "../../../scripts/mcp-fixture-template.mjs";
async function main() {
	process.env.MCP_TEST_TEMPLATE_ID = randomUUID();
	const first = await createMcpPostgresFixture();
	let second: Awaited<ReturnType<typeof createMcpPostgresFixture>> | undefined;
	try {
		await first.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('template-proof','template@example.invalid','Template','','user','free')");
		second = await createMcpPostgresFixture();
		const [templates, copied, tables] = await Promise.all([first.pool.query("SELECT count(*)::int AS count FROM pg_database WHERE datname=$1", [templateName(process.env.MCP_TEST_TEMPLATE_ID)]), second.pool.query("SELECT count(*)::int AS count FROM users WHERE id='template-proof'"), second.pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema IN ('public','auth')")]);
		console.log(JSON.stringify({ templates: templates.rows[0].count, leakedRows: copied.rows[0].count, tables: tables.rows[0].count, distinct: first.url !== second.url }));
	} finally {
		await second?.close();
		await first.close();
		await cleanupTemplate();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
