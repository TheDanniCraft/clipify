/** @jest-environment node */
import { fetchClipDiscovery } from "@/server/resources/clip-discovery";
import { getAccessTokenInternal } from "@/server/tokens";
jest.mock("@/server/tokens", () => ({ getAccessTokenInternal: jest.fn() }));
const token = jest.mocked(getAccessTokenInternal);
const originalFetch = globalThis.fetch;
const originalClient = process.env.TWITCH_CLIENT_ID;
const clip = { id: "Clip", title: "Minecraft", broadcaster_id: "creator", duration: 12, created_at: "2026-10-06T12:00:00Z", game_id: "27471", view_count: 1 };
let request: jest.Mock;
beforeEach(() => {
	token.mockReset();
	token.mockResolvedValue({ accessToken: "controlled-provider-token" } as any);
	process.env.TWITCH_CLIENT_ID = "controlled-client";
	request = jest.fn(async () => Response.json({ data: [clip], pagination: {} }));
	globalThis.fetch = request;
});
afterAll(() => {
	globalThis.fetch = originalFetch;
	if (originalClient === undefined) delete process.env.TWITCH_CLIENT_ID;
	else process.env.TWITCH_CLIENT_ID = originalClient;
});
test("provider requests use fixed Twitch endpoints, server credentials, error redirects and a bounded signal", async () => {
	const result = await fetchClipDiscovery("creator", {});
	expect(result).toMatchObject({ complete: true, scanned: 1, clips: [clip] });
	const [url, init] = request.mock.calls[0];
	expect(url.origin).toBe("https://api.twitch.tv");
	expect(url.pathname).toBe("/helix/clips");
	expect(url.searchParams.get("broadcaster_id")).toBe("creator");
	expect(init).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer controlled-provider-token", "Client-Id": "controlled-client" } });
	expect(init.signal).toBeInstanceOf(AbortSignal);
});
test.each(["missing-token", "missing-client"])("discovery refuses %s before contacting Twitch", async (mode) => {
	if (mode === "missing-token") token.mockResolvedValue(null);
	else delete process.env.TWITCH_CLIENT_ID;
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(request).not.toHaveBeenCalled();
});
test("numeric categories do not require game-name lookup", async () => {
	const result = await fetchClipDiscovery("creator", { category: "27471" });
	expect(result.clips.map((c) => c.id)).toEqual(["Clip"]);
	expect(request).toHaveBeenCalledTimes(1);
});
test("a missing category is a complete empty result rather than a broad unfiltered search", async () => {
	request.mockResolvedValue(Response.json({ data: [] }));
	expect(await fetchClipDiscovery("creator", { category: "Unknown" })).toEqual({ clips: [], providerAfter: undefined, scanned: 0, complete: true });
	expect(request).toHaveBeenCalledTimes(1);
});
test("malformed game metadata fails without using an unchecked category", async () => {
	request.mockResolvedValue(Response.json({ data: [{ id: "27471" }] }));
	await expect(fetchClipDiscovery("creator", { category: "Minecraft" })).rejects.toThrow("SERVICE_UNAVAILABLE");
});
test.each([429, 503])("provider status %s is projected as unavailable", async (status) => {
	request.mockResolvedValue(new Response(null, { status }));
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
});
test("provider exceptions do not escape as credential-bearing messages", async () => {
	request.mockRejectedValue(new Error("private-provider-details"));
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
});
test.each([{ data: [{ id: "broken" }] }, { data: [{ ...clip, broadcaster_id: "foreign" }] }, { data: [clip, clip] }])("malformed, foreign or duplicate clip rows fail %#", async (body) => {
	request.mockResolvedValue(Response.json(body));
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
});
test("duplicate IDs across pages fail rather than creating a repeated import selection", async () => {
	request.mockResolvedValueOnce(Response.json({ data: [clip], pagination: { cursor: "next" } })).mockResolvedValueOnce(Response.json({ data: [clip], pagination: {} }));
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(request).toHaveBeenCalledTimes(2);
});
test("bounded discovery returns continuation state and never claims an unfinished scan is complete", async () => {
	request.mockImplementation(async (_url: URL) => Response.json({ data: [{ ...clip, id: `Clip${request.mock.calls.length}` }], pagination: { cursor: `next${request.mock.calls.length}` } }));
	const result = await fetchClipDiscovery("creator", { startedAt: "2026-10-06T00:00:00Z", endedAt: "2026-10-07T00:00:00Z" }, "previous");
	expect(result.complete).toBe(false);
	expect(result.scanned).toBe(5);
	expect(result.providerAfter).toBe("next5");
	expect(request).toHaveBeenCalledTimes(5);
	expect(request.mock.calls[0][0].searchParams.get("after")).toBe("previous");
	expect(request.mock.calls[0][0].searchParams.get("started_at")).toBe("2026-10-06T00:00:00Z");
});
test("repeated cursors fail without looping indefinitely", async () => {
	request.mockImplementation(async () => Response.json({ data: [{ ...clip, id: `Clip${request.mock.calls.length}` }], pagination: { cursor: "same" } }));
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(request).toHaveBeenCalledTimes(2);
});
