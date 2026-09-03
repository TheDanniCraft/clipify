/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import type { PGlite as PGliteDatabase } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { badgeSlugs } from "@lib/badgeCatalog";

declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: PGliteDatabase;
const script = readFileSync(join(process.cwd(), "docs/member-badge-test.sql"), "utf8");
const badgeEnumValues = badgeSlugs.map((slug) => `'${slug}'`).join(", ");

describe("manual Beta Member test badge SQL", () => {
	beforeAll(async () => {
		database = new PGlite();
		// Isolated fixture matching the generated enum and award table; never a migration.
		await database.exec(`
			CREATE TABLE users (id varchar PRIMARY KEY);
			CREATE TYPE badge AS ENUM (${badgeEnumValues});
			CREATE TABLE user_badges (user_id varchar NOT NULL REFERENCES users(id), badge_slug badge NOT NULL, awarded_at timestamptz NOT NULL DEFAULT now(), awarded_by varchar, source varchar(80), PRIMARY KEY(user_id, badge_slug));
		`);
	}, 30000);
	beforeEach(async () => {
		await database.exec("TRUNCATE user_badges, users");
	});
	afterAll(async () => {
		await database?.close();
	});

	it("grants only the requested account and can be rerun without duplicate awards", async () => {
		await database.exec("INSERT INTO users VALUES ('274252231'), ('other-user')");
		await database.exec(script);
		const first = await database.query("SELECT * FROM user_badges");
		await database.exec(script);
		expect((await database.query("SELECT * FROM user_badges")).rows).toEqual(first.rows);
		expect(first.rows).toEqual([expect.objectContaining({ user_id: "274252231", badge_slug: "beta-member-test", source: "manual-test" })]);
	});

	it("does not leave an award behind when the target user is missing", async () => {
		await expect(database.exec(script)).rejects.toThrow();
		await database.exec("ROLLBACK");
		expect((await database.query("SELECT * FROM user_badges")).rows).toEqual([]);
	});

	it("rejects badge values that are not defined by the registry", async () => {
		await database.exec("INSERT INTO users VALUES ('274252231')");
		await expect(database.exec("INSERT INTO user_badges (user_id, badge_slug) VALUES ('274252231', 'made-up-badge')")).rejects.toThrow();
	});
});
