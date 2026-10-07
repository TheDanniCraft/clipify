/** @jest-environment node */
import { getTableConfig } from "drizzle-orm/pg-core";
import { overlaysTable, playlistsTable } from "@/db/schema";
let revisions: any;
try {
	revisions = require("@/server/resources/revisions");
} catch {}
describe("TDD-US2-038 revision prerequisites", () => {
	test.each([overlaysTable, playlistsTable])("resources start with a nonnullable revision of one", (table) => {
		const revision = getTableConfig(table).columns.find((column) => column.name === "configuration_revision");
		expect(revision).toBeDefined();
		expect(revision?.notNull).toBe(true);
		expect(revision?.default).toBe(1);
	});
	test("matching revision advances exactly once", () => {
		expect(revisions?.nextConfigurationRevision).toEqual(expect.any(Function));
		expect(revisions.nextConfigurationRevision(1, 1)).toBe(2);
		expect(revisions.nextConfigurationRevision(57, 57)).toBe(58);
	});
	test.each([undefined, null, 0, -1, 1.2, "1", 2_147_483_648])("invalid expected revision %p fails without producing a revision", (expected) => {
		expect(revisions?.nextConfigurationRevision).toEqual(expect.any(Function));
		expect(() => revisions.nextConfigurationRevision(1, expected)).toThrow("INVALID_INPUT");
	});
	test("stale revision is distinct from malformed input", () => {
		expect(revisions?.nextConfigurationRevision).toEqual(expect.any(Function));
		expect(() => revisions.nextConfigurationRevision(2, 1)).toThrow("REVISION_CONFLICT");
	});
	test("revision exhaustion fails closed", () => {
		expect(revisions?.nextConfigurationRevision).toEqual(expect.any(Function));
		expect(() => revisions.nextConfigurationRevision(2_147_483_647, 2_147_483_647)).toThrow("REVISION_CONFLICT");
	});
	test.each([
		[overlaysTable, "overlays_revision_positive"],
		[playlistsTable, "playlists_revision_positive"],
	])("database rejects nonpositive configuration revisions", (table, name) => {
		expect(getTableConfig(table as typeof overlaysTable).checks.map((check) => check.name)).toContain(name);
	});
});
