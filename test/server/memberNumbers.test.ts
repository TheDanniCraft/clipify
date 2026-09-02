/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import type { PGlite as PGliteDatabase } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const execute = jest.fn();
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));

import { allocateMemberNumber, memberNumberAllocationQuery } from "@/server/memberNumbers";

const dialect = new PgDialect();
declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: PGliteDatabase;
const runbook = readFileSync(join(process.cwd(), "docs/member-badges-backfill.sql"), "utf8");

async function legacyMembers(count = 100) {
	await database.query("INSERT INTO users (id) SELECT n::text FROM generate_series(1, $1::integer) n", [count]);
}

async function backfill(mapping: string) {
	try {
		await database.exec(runbook.replace("-- Populate the reviewed mapping here.", `${mapping};\n-- Populate the reviewed mapping here.`));
	} catch (error) {
		await database.exec("ROLLBACK");
		throw error;
	}
}

describe("persisted member-number allocator (embedded PostgreSQL)", () => {
	beforeAll(async () => {
		database = new PGlite();
		// Minimal isolated database fixture, never a production migration.
		await database.exec(`
			CREATE TABLE users (id varchar PRIMARY KEY, username varchar, member_number integer, created_at timestamptz, twitch_created_at timestamptz);
			CREATE UNIQUE INDEX users_member_number_unique ON users(member_number) WHERE member_number > 0;
			CREATE TABLE member_number_allocator (
				id integer PRIMARY KEY CHECK (id = 1),
				legacy_reserved_through integer NOT NULL,
				last_allocated integer NOT NULL,
				CHECK (legacy_reserved_through >= 0 AND last_allocated >= legacy_reserved_through)
			);
		`);
	}, 30000);

	beforeEach(async () => {
		await database.exec("TRUNCATE users, member_number_allocator");
		execute.mockReset();
		execute.mockImplementation(async (query) => {
			const { sql, params } = dialect.sqlToQuery(query);
			return database.query(sql, params);
		});
	});

	afterAll(async () => {
		await database?.close();
	});

	it("starts at one for an empty community", async () => {
		expect(await allocateMemberNumber()).toBe(1);
	});

	it("reserves the existing population without modifying legacy accounts", async () => {
		await legacyMembers();
		expect(await allocateMemberNumber()).toBe(101);
		expect((await database.query("SELECT count(*)::int AS count FROM users WHERE member_number IS NULL")).rows).toEqual([{ count: 100 }]);
	});

	it("does not collide after a legacy account is deleted", async () => {
		await legacyMembers();
		const first = await allocateMemberNumber();
		await database.query("INSERT INTO users (id, member_number) VALUES ('new', $1)", [first]);
		await database.exec("DELETE FROM users WHERE id = '1'");
		expect(await allocateMemberNumber()).toBe(102);
	});

	it("does not recycle numbers after an issued account is deleted or an insert fails", async () => {
		await legacyMembers();
		const first = await allocateMemberNumber();
		await database.query("INSERT INTO users (id, member_number) VALUES ('new', $1)", [first]);
		await database.exec("DELETE FROM users WHERE id = 'new'");
		expect(await allocateMemberNumber()).toBe(102);
		// Number 102 has been issued but no user row was committed for it.
		expect(await allocateMemberNumber()).toBe(103);
	});

	it("initializes above existing positive numbers as well as population", async () => {
		await database.exec("INSERT INTO users (id, member_number) VALUES ('existing', 500)");
		expect(await allocateMemberNumber()).toBe(501);
	});

	it("allocates distinct values for overlapping first-use calls", async () => {
		await legacyMembers();
		const numbers = await Promise.all(Array.from({ length: 20 }, () => allocateMemberNumber()));
		expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => 101 + i));
		expect((await database.query("SELECT legacy_reserved_through, last_allocated FROM member_number_allocator")).rows).toEqual([{ legacy_reserved_through: 100, last_allocated: 120 }]);
	});

	it("keeps the new-user range disjoint from backfill and in-flight allocations", async () => {
		await legacyMembers();
		const pending = await allocateMemberNumber();
		await backfill("INSERT INTO member_number_backfill SELECT id, CASE WHEN id = '1' THEN 1 ELSE 0 END FROM users");
		expect(await allocateMemberNumber()).toBe(102);
		await database.query("INSERT INTO users (id, member_number) VALUES ('pending', $1)", [pending]);
		expect(await allocateMemberNumber()).toBe(103);
	});

	it("supports backfill before first signup and idempotent reruns", async () => {
		await legacyMembers();
		const mapping = "INSERT INTO member_number_backfill SELECT id, CASE WHEN id = '1' THEN 1 ELSE 0 END FROM users";
		await backfill(mapping);
		await backfill(mapping);
		expect(await allocateMemberNumber()).toBe(101);
	});

	it("rejects backfill into the new-user range", async () => {
		await legacyMembers(2);
		await allocateMemberNumber();
		await expect(backfill("INSERT INTO member_number_backfill VALUES ('1', 3), ('2', 0)")).rejects.toThrow("reserved legacy range");
		expect(await allocateMemberNumber()).toBe(4);
	});

	it("rejects renumbering an already assigned account", async () => {
		await legacyMembers(2);
		await allocateMemberNumber();
		await database.exec("UPDATE users SET member_number = 1 WHERE id = '1'");
		await expect(backfill("INSERT INTO member_number_backfill VALUES ('1', 2), ('2', 0)")).rejects.toThrow("already assigned");
	});

	it("rolls back a partial backfill without resetting the allocator", async () => {
		await legacyMembers(2);
		await allocateMemberNumber();
		await expect(backfill("INSERT INTO member_number_backfill VALUES ('1', 1)")).rejects.toThrow("every legacy account");
		expect((await database.query("SELECT member_number FROM users WHERE id = '1'")).rows).toEqual([{ member_number: null }]);
		expect(await allocateMemberNumber()).toBe(4);
	});

	it("fails explicitly when the allocation result is missing", async () => {
		execute.mockResolvedValueOnce({ rows: [] });
		await expect(allocateMemberNumber()).rejects.toThrow("Could not allocate");
	});

	it("uses the same SQL boundary for all allocator calls", async () => {
		await allocateMemberNumber();
		expect(execute).toHaveBeenCalledWith(memberNumberAllocationQuery);
	});
});
