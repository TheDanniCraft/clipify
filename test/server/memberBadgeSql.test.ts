/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import type { PGlite as PGliteDatabase } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: PGliteDatabase;
const script = readFileSync(join(process.cwd(), "docs/member-badge-test.sql"), "utf8");

describe("manual Beta Member test badge SQL", () => {
	beforeAll(async () => {
		database = new PGlite();
		// Isolated fixture matching the badge columns/constraints; never a migration.
		await database.exec(`
			CREATE TABLE users (id varchar PRIMARY KEY);
			CREATE TABLE badges (slug varchar(64) PRIMARY KEY, name varchar(80) NOT NULL, description text NOT NULL, icon varchar(64), priority integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
			CREATE TABLE user_badges (user_id varchar NOT NULL REFERENCES users(id), badge_slug varchar(64) NOT NULL REFERENCES badges(slug), awarded_at timestamptz NOT NULL DEFAULT now(), awarded_by varchar, source varchar(80), PRIMARY KEY(user_id, badge_slug));
		`);
	}, 30000);
	beforeEach(async () => {
		await database.exec("TRUNCATE user_badges, badges, users");
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
		expect((await database.query("SELECT name FROM badges")).rows).toEqual([{ name: "Beta Member" }]);
	});

	it("does not leave a badge definition behind when the target user is missing", async () => {
		await expect(database.exec(script)).rejects.toThrow();
		await database.exec("ROLLBACK");
		expect((await database.query("SELECT * FROM badges")).rows).toEqual([]);
	});
});
