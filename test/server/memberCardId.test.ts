/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import type { PGlite as PGliteDatabase } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { usersTable } from "@/db/schema";
import { memberCardIdExpression, memberCardIdForUser } from "@/server/memberCardId";

declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
const dialect = new PgDialect();
let database: PGliteDatabase;

async function lookup(cardId: string) {
	const query = dialect.sqlToQuery(sql`SELECT id FROM ${usersTable} WHERE ${and(eq(memberCardIdExpression(usersTable.id), cardId), eq(usersTable.disabled, false))}`);
	return (await database.query<{ id: string }>(query.sql, query.params)).rows;
}

describe("derived member card UUIDs (embedded PostgreSQL)", () => {
	beforeAll(async () => {
		database = new PGlite();
		// Isolated test fixture only. No stored card identifier or database extension.
		await database.exec("CREATE TABLE users (id varchar PRIMARY KEY, username varchar, disabled boolean NOT NULL DEFAULT false)");
	}, 30000);

	beforeEach(async () => {
		await database.exec("TRUNCATE users");
	});

	afterAll(async () => {
		await database?.close();
	});

	it.each(["1", "123456789", "9876543210", "user-with-symbols\\'", "ümlaut-你好"])("matches the application derivation for %s", async (id) => {
		const query = dialect.sqlToQuery(sql`SELECT ${memberCardIdExpression(sql`${id}::text`)} AS card_id`);
		const result = await database.query<{ card_id: string }>(query.sql, query.params);
		expect(result.rows).toEqual([{ card_id: memberCardIdForUser(id) }]);
		expect(result.rows[0].card_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it("keeps links stable through a rename and works for new and legacy accounts without backfill", async () => {
		await database.query("INSERT INTO users (id, username) VALUES ($1, $2)", ["123456789", "old-name"]);
		const id = memberCardIdForUser("123456789");
		expect(await lookup(id)).toEqual([{ id: "123456789" }]);
		await database.exec("UPDATE users SET username = 'new-name'; INSERT INTO users (id) VALUES ('987654321')");
		expect(await lookup(id)).toEqual([{ id: "123456789" }]);
		expect(await lookup(id.toUpperCase())).toEqual([{ id: "123456789" }]);
		expect(await lookup(memberCardIdForUser("987654321"))).toEqual([{ id: "987654321" }]);
		expect(usersTable).not.toHaveProperty("memberCardId");
	});

	it("does not resolve missing or disabled accounts", async () => {
		expect(await lookup(memberCardIdForUser("123"))).toEqual([]);
		await database.exec("INSERT INTO users (id, disabled) VALUES ('123', true)");
		expect(await lookup(memberCardIdForUser("123"))).toEqual([]);
	});

	it("produces distinct identifiers across a sample of adjacent user IDs", () => {
		const identifiers = Array.from({ length: 1000 }, (_, i) => memberCardIdForUser(String(i + 1)));
		expect(new Set(identifiers).size).toBe(identifiers.length);
	});

	it("freezes the public URL contract across deployments", () => {
		expect(memberCardIdForUser("123456789")).toBe("5e514012-3dde-84b7-a480-fadc254c4a33");
	});
});
