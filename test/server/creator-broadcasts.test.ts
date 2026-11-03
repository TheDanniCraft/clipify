/** @jest-environment node */
import { sealBroadcastCursor, parseBroadcastCursor } from "@/server/creator-broadcasts";
it("U42: binds an opaque provider cursor to its creator", () => {
	const cursor = sealBroadcastCursor("owner", "next-page");
	expect(parseBroadcastCursor(cursor, "owner")).toBe("next-page");
	expect(() => parseBroadcastCursor(cursor, "other")).toThrow("INVALID_INPUT");
});

const authorize = jest.fn();
const library = jest.fn();
const token = jest.fn();
const cache = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/server/creator-library", () => ({ readCreatorLibrary: (...args: unknown[]) => library(...args) }));
jest.mock("@/server/tokens", () => ({ getAccessTokenResultInternal: (...args: unknown[]) => token(...args) }));
jest.mock("@actions/database", () => ({ getTwitchCacheEntry: () => cache(), setTwitchCache: jest.fn() }));
afterEach(() => jest.restoreAllMocks());
it("U39-U41: lists owned archives newest first including streams with zero clips", async () => {
	authorize.mockResolvedValue({ allowed: true });
	library.mockResolvedValue({ ok: true, clips: [{ video_id: "100", view_count: 12 }] });
	token.mockResolvedValue({ token: { accessToken: "private-token" } });
	cache.mockResolvedValue({ hit: false, value: null });
	const video = (id: string, type: string, created_at: string, user_id = "owner") => ({ id, type, created_at, user_id, title: id, duration: "1h", thumbnail_url: "" });
	jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [video("100", "archive", "2026-11-01T00:00:00Z"), video("200", "archive", "2026-11-02T00:00:00Z"), video("300", "highlight", "2026-11-03T00:00:00Z"), video("400", "archive", "2026-11-03T00:00:00Z", "foreign")], pagination: {} }));
	const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
	expect(await readCreatorBroadcasts("owner")).toMatchObject({
		ok: true,
		items: [
			{ id: "200", clipCount: 0, clipViews: 0 },
			{ id: "100", clipCount: 1, clipViews: 12 },
		],
		stale: false,
		nextCursor: null,
	});
});

const archiveVideo = { id: "100", user_id: "owner", title: "Stream", type: "archive", duration: "1h", created_at: "2026-11-01T00:00:00Z", thumbnail_url: "" };
describe("broadcast cache and recovery", () => {
	beforeEach(() => {
		authorize.mockReset().mockResolvedValue({ allowed: true });
		library.mockReset().mockResolvedValue({ ok: true, clips: [] });
		token.mockReset().mockResolvedValue({ token: { accessToken: "private" } });
		cache.mockReset().mockResolvedValue({ value: null });
	});
	it("denies foreign access before cache or provider reads", async () => {
		authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("foreign")).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(cache).not.toHaveBeenCalled();
	});
	it("uses fresh cached metadata without contacting Twitch", async () => {
		cache.mockResolvedValue({ value: { data: [archiveVideo], fetchedAt: new Date().toISOString() } });
		const fetch = jest.spyOn(globalThis, "fetch");
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toMatchObject({ ok: true, stale: false, items: [{ id: "100" }] });
		expect(fetch).not.toHaveBeenCalled();
	});
	it("retains stale metadata when Twitch is temporarily unavailable", async () => {
		cache.mockResolvedValue({ value: { data: [archiveVideo], fetchedAt: "2026-01-01T00:00:00Z" } });
		jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toMatchObject({ ok: true, stale: true, items: [{ id: "100" }] });
	});
	it("does not invent zero counts when the clip cache is unavailable", async () => {
		cache.mockResolvedValue({ value: { data: [archiveVideo], fetchedAt: new Date().toISOString() } });
		library.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toMatchObject({ ok: true, items: [{ clipCount: null, clipViews: null }] });
	});
	it("offers reconnection when no usable token or cached metadata exists", async () => {
		token.mockResolvedValue({ token: null });
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toEqual({ ok: false, code: "RECONNECT_REQUIRED" });
	});
	it("rejects invalid video identifiers before reading metadata", async () => {
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner", undefined, "../foreign")).toEqual({ ok: false, code: "INVALID_INPUT" });
		expect(cache).not.toHaveBeenCalled();
	});
	it.each(["bad", "x".repeat(2049), "a." + "x".repeat(43)])("rejects malformed or tampered cursors %#", (cursor) => expect(() => parseBroadcastCursor(cursor, "owner")).toThrow("INVALID_INPUT"));
	it("accepts an omitted cursor", () => expect(parseBroadcastCursor(undefined, "owner")).toBeUndefined());
	it("does not serve a deleted broadcast from a stale cache", async () => {
		cache.mockResolvedValue({ value: { data: [archiveVideo], fetchedAt: "2026-01-01T00:00:00Z" } });
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner", undefined, "100")).toEqual({ ok: false, code: "NOT_FOUND" });
	});
});
describe("provider response and signed cursor boundaries", () => {
	beforeEach(() => {
		authorize.mockResolvedValue({ allowed: true });
		library.mockResolvedValue({ ok: true, clips: [] });
		token.mockResolvedValue({ token: { accessToken: "private" } });
		cache.mockResolvedValue({ value: null });
	});
	it.each([401, 500])("maps provider HTTP %i without an empty success", async (status) => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status }));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toEqual({ ok: false, code: status === 401 ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE" });
	});
	it("rejects malformed provider data", async () => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [{ id: "bad" }] }));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner")).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
	});
	it("forwards only a verified provider cursor and seals the next cursor", async () => {
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [archiveVideo], pagination: { cursor: "next" } }));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		const result = await readCreatorBroadcasts("owner", sealBroadcastCursor("owner", "previous"));
		expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("after")).toBe("previous");
		if (!result.ok) throw new Error(result.code);
		expect(parseBroadcastCursor(result.nextCursor!, "owner")).toBe("next");
	});
	it("requests an exact VOD without accepting a different returned identity", async () => {
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [archiveVideo, { ...archiveVideo, id: "200" }], pagination: {} }));
		const { readCreatorBroadcasts } = await import("@/server/creator-broadcasts");
		expect(await readCreatorBroadcasts("owner", undefined, "200")).toMatchObject({ ok: true, items: [{ id: "200" }] });
		expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("id")).toBe("200");
	});
	it("requires a signing secret and bounds cursors on creation", () => {
		const prior = process.env.JWT_SECRET;
		delete process.env.JWT_SECRET;
		try {
			expect(() => sealBroadcastCursor("owner", "next")).toThrow("SERVICE_UNAVAILABLE");
		} finally {
			process.env.JWT_SECRET = prior;
		}
		expect(() => sealBroadcastCursor("owner", "x".repeat(2000))).toThrow("INVALID_INPUT");
	});
});
