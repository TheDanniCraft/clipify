/** @jest-environment node */
import { saveBroadcasts, readSavedBroadcasts, syncBroadcastArchive, markBroadcastUnavailable, ensureBroadcastCollection } from "@/server/broadcast-archive";
const query = jest.fn();
const token = jest.fn();
jest.mock("@/db/client", () => ({ dbPool: { query: (...args: unknown[]) => query(...args) } }));
jest.mock("@/server/tokens", () => ({ getAccessTokenResultInternal: (...args: unknown[]) => token(...args) }));
const video = { id: "123", user_id: "owner", title: "Saved stream", created_at: "2026-11-01T00:00:00Z", type: "archive", duration: "1h", thumbnail_url: "" };
beforeEach(() => {
	query.mockReset().mockResolvedValue({ rows: [] });
	token.mockReset().mockResolvedValue({ token: { accessToken: "private" } });
});
afterEach(() => jest.restoreAllMocks());
it("stores metadata in creator-owned persistent records and rejects foreign broadcasts", async () => {
	await saveBroadcasts("owner", [video, { ...video, id: "456", user_id: "foreign" }], new Date().toISOString());
	const [sql, params] = query.mock.calls[0];
	expect(sql).toContain("user_content_states");
	expect(params[0]).toBe("owner");
	const records = JSON.parse(params[1]);
	expect(records).toHaveLength(1);
	expect(records[0].key).toBe("broadcast:v1:123");
	expect(records[0].state).not.toContain("private");
});
it("reads only validated creator-owned saved metadata without expiration filtering", async () => {
	query.mockResolvedValue({ rows: [{ state: JSON.stringify({ video, lastSeenAt: "2026-11-01T00:00:00Z", unavailable: true }) }, { state: JSON.stringify({ video: { ...video, user_id: "foreign" }, lastSeenAt: "2026-11-01T00:00:00Z" }) }, { state: "broken" }] });
	expect(await readSavedBroadcasts("owner")).toEqual([{ video, lastSeenAt: "2026-11-01T00:00:00Z", unavailable: true }]);
	expect(query.mock.calls[0][1]).toEqual(["owner"]);
	expect(query.mock.calls[0][0]).not.toContain("expires_at");
});
it("collects at most one bounded provider page and checkpoints the next cursor", async () => {
	const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [video], pagination: { cursor: "next" } }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: true });
	const url = new URL(String(fetch.mock.calls[0][0]));
	expect(url.searchParams.get("first")).toBe("100");
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(query.mock.calls.some(([, params]) => JSON.stringify(params).includes("next"))).toBe(true);
});
it("respects persisted provider backoff and never replaces saved streams with a provider error", async () => {
	query.mockResolvedValueOnce({ rows: [{ state: JSON.stringify({ retryAt: new Date(Date.now() + 60000).toISOString() }) }] });
	const fetch = jest.spyOn(globalThis, "fetch");
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: true });
	expect(fetch).not.toHaveBeenCalled();
	query.mockResolvedValue({ rows: [] });
	fetch.mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": "120" } }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "RATE_LIMITED" });
	expect(query.mock.calls.some(([sql]) => String(sql).startsWith("DELETE"))).toBe(false);
});
it("backs off transport failures without clearing the saved archive", async () => {
	jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("network down"));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	expect(query.mock.calls.some(([sql, params]) => String(sql).includes("'broadcast-sync:v1'") && String(params?.[1]).includes("retryAt"))).toBe(true);
});
it("resets an unchanged provider cursor instead of getting stuck collecting the same old page", async () => {
	query.mockResolvedValueOnce({ rows: [{ state: JSON.stringify({ cursor: "same", cycleStartedAt: "2026-11-01T00:00:00Z" }) }] });
	jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [video], pagination: { cursor: "same" } }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	const checkpoint = query.mock.calls.find(([sql]) => String(sql).includes("VALUES($1,'broadcast-sync:v1'"));
	expect(JSON.parse(checkpoint![1][1])).not.toHaveProperty("cursor");
});
it("ignores invalid and non-archive metadata without writing a record", async () => {
	await saveBroadcasts("owner", [{}, { ...video, type: "highlight" }, { ...video, id: "not-a-video" }], new Date().toISOString());
	expect(query).not.toHaveBeenCalled();
});
it("defaults older saved metadata to available without losing creator ownership", async () => {
	query.mockResolvedValue({ rows: [{ state: JSON.stringify({ video, lastSeenAt: "2026-11-01T00:00:00Z" }) }] });
	expect(await readSavedBroadcasts("owner")).toEqual([{ video, lastSeenAt: "2026-11-01T00:00:00Z", unavailable: false }]);
});
it("does not request Twitch without a usable account token", async () => {
	token.mockResolvedValue({});
	const fetch = jest.spyOn(globalThis, "fetch");
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "RECONNECT_REQUIRED" });
	expect(fetch).not.toHaveBeenCalled();
});
it.each([400, 401, 500])("persists recovery state for provider status %i without deleting history", async (status) => {
	query.mockResolvedValueOnce({ rows: [{ state: JSON.stringify({ cursor: "old", cycleStartedAt: "2026-11-01T00:00:00Z" }) }] });
	jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: status === 401 ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE" });
	const checkpoint = query.mock.calls.find(([sql]) => String(sql).includes("VALUES($1,'broadcast-sync:v1'"));
	const state = JSON.parse(checkpoint![1][1]);
	expect(state.retryAt).toBeTruthy();
	expect(state.cursor).toBe(status === 400 ? undefined : "old");
});
it("marks missing recordings unavailable only after the final provider page, retaining their records", async () => {
	jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [], pagination: {} }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: true });
	expect(query.mock.calls.some(([sql, params]) => String(sql).startsWith("UPDATE user_content_states") && params[0] === "owner")).toBe(true);
	expect(query.mock.calls.some(([sql]) => String(sql).startsWith("DELETE"))).toBe(false);
});
it("backs off malformed and oversized provider payloads rather than overwriting valid metadata", async () => {
	const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [{ id: "bad" }] }));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	fetch.mockResolvedValue(new Response(new Uint8Array(1024 * 1024 + 1)));
	expect(await syncBroadcastArchive("owner")).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
});

it("marks missing recordings without deleting metadata and schedules only active creator collection", async () => {
	await markBroadcastUnavailable("owner", "123");
	expect(query.mock.calls[0][1]).toEqual(["owner", "broadcast:v1:123"]);
	expect(query.mock.calls[0][0]).toContain("UPDATE user_content_states");
	await ensureBroadcastCollection("owner");
	expect(query.mock.calls[1][1]).toEqual(["owner"]);
	expect(query.mock.calls[1][0]).toContain("NOT disabled ON CONFLICT");
});
