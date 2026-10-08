import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { is, Table, SQL } from "drizzle-orm";
import * as domain from "@/db/schema";
import * as auth from "@/db/auth-schema";
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: unknown): string => (value === null ? "NULL" : Array.isArray(value) ? `ARRAY[${value.map(literal).join(",")}]` : typeof value === "number" || typeof value === "boolean" ? String(value) : value && typeof value === "object" ? literal(JSON.stringify(value)) : `'${String(value).replaceAll("'", "''")}'`);

/** Disposable database per test; never push an application schema or use secrets. */
export async function createMcpPostgresFixture() {
	const url = new URL(process.env.MCP_TEST_DATABASE_URL ?? "postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !/^\/clipify_(mcp_fixture|e2e)$/.test(url.pathname)) throw new Error("MCP tests require a disposable loopback fixture database");
	const admin = new Pool({ connectionString: url.href });
	const name = `mcp_${randomUUID().replaceAll("-", "")}`;
	await admin.query(`CREATE DATABASE ${quote(name)}`);
	url.pathname = `/${name}`;
	const pool = new Pool({ connectionString: url.href, max: 30 });
	try {
		await initializeMcpFixtureSchema(pool);
		return {
			pool,
			url: url.href,
			db: drizzle(pool, { schema: { ...domain, ...auth } }),
			close: async () => {
				await pool.end();
				await dropFixtureDatabase(admin, name);
				await admin.end();
			},
		};
	} catch (error) {
		await pool.end();
		await dropFixtureDatabase(admin, name);
		await admin.end();
		throw error;
	}
}

async function dropFixtureDatabase(admin: Pool, name: string) {
	const deadline = performance.now() + 5000;
	while (true) {
		const sessions = await admin.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1", [name]);
		if (Number(sessions.rows[0].count) === 0) break;
		if (performance.now() >= deadline) throw new Error("MCP fixture cleanup found an undrained database connection");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	// pg Pool.end resolves before the last TCP shutdown is visible to PostgreSQL.
	// Normal DROP after draining avoids FORCE sending FATAL to an ending client.
	await admin.query(`DROP DATABASE ${quote(name)}`);
}

export async function initializeMcpFixtureSchema(pool: Pick<Pool, "query">) {
	const dialect = new PgDialect();
	const tables = Object.values({ ...domain, ...auth })
		.filter((table) => is(table, Table))
		.map((table) => getTableConfig(table as any));
	await pool.query('CREATE SCHEMA IF NOT EXISTS "auth"');
	async function createFixtureEnums() {
		const enums = new Map<string, readonly string[]>();
		for (const table of tables) for (const column of table.columns) if (column.enumValues?.length && column.getSQLType() !== "text" && !column.getSQLType().startsWith("varchar")) enums.set(column.getSQLType(), column.enumValues);
		for (const [name, values] of enums) await pool.query(`CREATE TYPE ${quote(name)} AS ENUM (${values.map(literal).join(",")})`);
		return { enums };
	}
	const { enums } = await createFixtureEnums();
	for (const table of tables) {
		const fields = table.columns.map((column) => {
			const type = column.getSQLType();
			let definition = `${quote(column.name)} ${enums.has(type) ? quote(type) : type}`;
			if (column.notNull) definition += " NOT NULL";
			if (column.primary) definition += " PRIMARY KEY";
			if (column.isUnique) definition += " UNIQUE";
			if (column.default !== undefined) definition += ` DEFAULT ${is(column.default, SQL) ? dialect.sqlToQuery(column.default).sql : literal(type === "jsonb" ? JSON.stringify(column.default) : column.default)}${Array.isArray(column.default) && type !== "jsonb" ? `::${type}` : ""}`;
			return definition;
		});
		for (const key of table.primaryKeys) fields.push(`PRIMARY KEY (${key.columns.map((c) => quote(c.name)).join(",")})`);
		for (const key of table.uniqueConstraints) fields.push(`UNIQUE (${key.columns.map((c) => quote(c.name)).join(",")})`);
		for (const check of table.checks) fields.push(`CONSTRAINT ${quote(check.name)} CHECK (${dialect.sqlToQuery(check.value).sql})`);
		const statement = `CREATE TABLE ${quote(table.schema ?? "public")}.${quote(table.name)} (${fields.join(",")})`;
		try {
			await pool.query(statement);
		} catch (error) {
			console.error(statement);
			throw error;
		}
	}
	async function createFixtureIndexesAndForeignKeys() {
		for (const table of tables)
			for (const index of table.indexes) {
				const config = index.config;
				const expression = config.columns.map((column) => (is(column, SQL) ? dialect.sqlToQuery(column).sql : quote((column as { name: string }).name))).join(",");
				await pool.query(`CREATE ${config.unique ? "UNIQUE " : ""}INDEX ${quote(config.name ?? `${table.name}_fixture_index`)} ON ${quote(table.schema ?? "public")}.${quote(table.name)} (${expression})${config.where ? ` WHERE ${dialect.sqlToQuery(config.where).sql}` : ""}`);
			}
		// Foreign keys added after every table exists; preserves schema-owned invariants.
		for (const table of tables)
			for (const fk of table.foreignKeys) {
				const reference = fk.reference();
				const target = getTableConfig(reference.foreignTable);
				await pool.query(`ALTER TABLE ${quote(table.schema ?? "public")}.${quote(table.name)} ADD CONSTRAINT ${quote(fk.getName())} FOREIGN KEY (${reference.columns.map((c) => quote(c.name)).join(",")}) REFERENCES ${quote(target.schema ?? "public")}.${quote(target.name)} (${reference.foreignColumns.map((c) => quote(c.name)).join(",")}) ON DELETE ${fk.onDelete ?? "no action"}`);
			}
	}
	await createFixtureIndexesAndForeignKeys();
}
