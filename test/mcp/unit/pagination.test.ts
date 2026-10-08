/** @jest-environment node */
jest.mock("server-only", () => ({}));
let pagination: any;
try {
	pagination = require("@/server/mcp/pagination");
} catch {}
const secret = "fixture-pagination-secret-32-characters",
	context = "grant-1:creator-1:list_overlays",
	now = new Date("2026-10-05T00:00:00Z");
describe("TDD-US2-032 pagination inner boundaries", () => {
	test("signed cursor round trips the last stable ID only in the same query context", () => {
		expect(pagination?.encodePageCursor).toEqual(expect.any(Function));
		const cursor = pagination.encodePageCursor("resource-1", context, { secret, now });
		expect(cursor).not.toContain("resource-1");
		expect(pagination.decodePageCursor(cursor, context, { secret, now })).toBe("resource-1");
	});
	test.each(["other-grant:creator-1:list_overlays", "grant-1:creator-2:list_overlays", "grant-1:creator-1:list_playlists"])("rejects changed context %s", (changed) => {
		expect(pagination?.encodePageCursor).toEqual(expect.any(Function));
		const cursor = pagination.encodePageCursor("resource-1", context, { secret, now });
		expect(() => pagination.decodePageCursor(cursor, changed, { secret, now })).toThrow("INVALID_INPUT");
	});
	test("tampering and malformed cursors cannot choose unvalidated positions", () => {
		expect(pagination?.encodePageCursor).toEqual(expect.any(Function));
		const cursor = pagination.encodePageCursor("resource-1", context, { secret, now });
		for (const changed of ["invalid", cursor.slice(0, -5) + "XXXXX", "", "x".repeat(2049)]) expect(() => pagination.decodePageCursor(changed, context, { secret, now })).toThrow("INVALID_INPUT");
	});
	test("cursor rejects exactly at expiry and on a different signing key", () => {
		expect(pagination?.encodePageCursor).toEqual(expect.any(Function));
		const cursor = pagination.encodePageCursor("resource-1", context, { secret, now });
		expect(() => pagination.decodePageCursor(cursor, context, { secret, now: new Date(now.getTime() + 30 * 60 * 1000) })).toThrow("INVALID_INPUT");
		expect(() => pagination.decodePageCursor(cursor, context, { secret: "another-secret", now })).toThrow("INVALID_INPUT");
	});
	test("empty/oversized positions are never emitted", () => {
		expect(pagination?.encodePageCursor).toEqual(expect.any(Function));
		for (const id of ["", "x".repeat(256)]) expect(() => pagination.encodePageCursor(id, context, { secret, now })).toThrow("INVALID_INPUT");
	});
});

describe("TDD-US2-032 cursor signing configuration", () => {
	const original = { ...process.env };
	afterEach(() => {
		process.env = { ...original };
	});
	function clearKeys() {
		delete process.env.BETTER_AUTH_SECRET;
		delete process.env.JWT_SECRET;
	}
	test("supports the existing legacy authentication secret", () => {
		clearKeys();
		process.env.JWT_SECRET = secret;
		const cursor = pagination.encodePageCursor("resource-1", context, { now });
		expect(pagination.decodePageCursor(cursor, context, { secret, now })).toBe("resource-1");
	});
	test("fails closed if no signing configuration exists", () => {
		clearKeys();
		expect(() => pagination.encodePageCursor("resource-1", context, { now })).toThrow("SERVICE_UNAVAILABLE");
		expect(() => pagination.decodePageCursor("a.b", context, { now })).toThrow("SERVICE_UNAVAILABLE");
	});
	test("auth key precedes legacy fallback and explicit test key remains supported", () => {
		clearKeys();
		process.env.JWT_SECRET = "legacy";
		process.env.BETTER_AUTH_SECRET = secret;
		const cursor = pagination.encodePageCursor("resource-1", context, { now });
		expect(pagination.decodePageCursor(cursor, context, { secret, now })).toBe("resource-1");
		const explicit = pagination.encodePageCursor("resource-1", context, { secret: "explicit", now });
		expect(pagination.decodePageCursor(explicit, context, { secret: "explicit", now })).toBe("resource-1");
	});
});
