/** @jest-environment node */
const verify = jest.fn();
const access = jest.fn();
const search = jest.fn();
const readClip = jest.fn();
const searchCategories = jest.fn();
jest.mock("@/server/connected-apps/clip-read", () => ({ resolveConnectedClip: (...a: unknown[]) => readClip(...a) }));
jest.mock("better-auth/oauth2", () => ({ verifyAccessTokenRequest: (...args: unknown[]) => verify(...args), requestToResourceInput: (r: Request) => r }));
jest.mock("@/server/connected-apps/storage", () => ({ withConnectedAppGrant: (...args: unknown[]) => access(...args) }));
jest.mock("@/server/resources/cached-clip-search", () => ({ searchCachedClips: (...args: unknown[]) => search(...args) }));
jest.mock("@actions/twitch", () => ({ getTwitchGames: (...args: unknown[]) => searchCategories(...args) }));
jest.mock("@/app/lib/baseUrl", () => ({ resolveBaseUrl: () => new URL("https://clipify.test") }));
import { handleConnectedAppRequest } from "@/server/connected-apps/gateway";
const resource = "https://clipify.test/api/connected-apps";
const claims = () => ({ sub: "app", client_id: "app", scope: "creator:read", iss: "https://clipify.test/api/auth", aud: resource, exp: Math.floor(Date.now() / 1000) + 60, clipify_application: true });
const request = (body: unknown = { operation: "search_clips", input: { creatorId: "creator", filters: { title: "Minecraft" } } }) => new Request(resource, { method: "POST", headers: { Authorization: "Bearer scoped-machine", "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
	verify.mockReset().mockResolvedValue(claims());
	readClip.mockReset().mockResolvedValue({ creatorId: "creator", clip: { id: "ClipA", broadcasterId: "creator" } });
	search.mockReset().mockResolvedValue({ creatorId: "creator", items: [], complete: false, nextCursor: null });
	searchCategories.mockReset().mockResolvedValue([{ id: "509658", name: "Just Chatting", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg" }]);
	access.mockReset().mockImplementation(async (_identity, run) => run({ id: "grant" }));
});
it("searches Twitch categories through the creator-bound clip discovery grant", async () => {
	const response = await handleConnectedAppRequest(request({ operation: "search_categories", input: { creatorId: "creator", query: "chat", limit: 10 } }));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ ok: true, data: { creatorId: "creator", items: [{ id: "509658", name: "Just Chatting", artworkUrl: "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg" }] } });
	expect(access).toHaveBeenCalledWith(expect.objectContaining({ clientId: "app", creatorId: "creator", operation: "search_categories" }), expect.any(Function));
	expect(searchCategories).toHaveBeenCalledWith("chat", "creator");
});
it("does not expose an untrusted category artwork URL", async () => {
	searchCategories.mockResolvedValueOnce([{ id: "509658", name: "Just Chatting", box_art_url: "https://attacker.example/{width}x{height}.jpg" }]);
	const response = await handleConnectedAppRequest(request({ operation: "search_categories", input: { creatorId: "creator", query: "chat" } }));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ ok: true, data: { creatorId: "creator", items: [{ id: "509658", name: "Just Chatting", artworkUrl: null }] } });
});
it("returns a typed authentication denial without exposing missing-credential details", async () => {
	const response = await handleConnectedAppRequest(new Request(resource, { method: "POST" }));
	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ ok: false, error: { code: "AUTHENTICATION_REQUIRED" } });
	expect(search).not.toHaveBeenCalled();
});
it("executes only approved cached search with verified machine claims", async () => {
	const response = await handleConnectedAppRequest(request());
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ ok: true, data: { creatorId: "creator", complete: false } });
	expect(verify).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ verifyOptions: { issuer: "https://clipify.test/api/auth", audience: resource }, requiredScopes: ["creator:read"] }));
	expect(access).toHaveBeenCalledWith(expect.objectContaining({ clientId: "app", creatorId: "creator", operation: "search_clips" }), expect.any(Function));
	expect(search).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", filters: expect.objectContaining({ title: "Minecraft" }), limit: 25 }), "application:grant");
});
it.each([{ clipify_application: false }, { sub: "user" }, { scope: "creator:read overlay:update" }, { scope: "" }, { iss: "https://other.test/api/auth" }, { aud: "https://clipify.test/mcp" }, { exp: 0 }, { exp: NaN }])("rejects wrong machine identity or claims %j", async (change) => {
	verify.mockResolvedValue({ ...claims(), ...change });
	const response = await handleConnectedAppRequest(request());
	expect(response.status).toBe(401);
	expect(access).not.toHaveBeenCalled();
});
it.each([
	{ operation: "delete_creator", input: { creatorId: "creator" } },
	{ operation: "search_clips", input: { creatorId: "creator", filters: { unknown: true } } },
	{ operation: "search_clips", input: { creatorId: "creator", limit: 101 } },
	{ operation: "search_clips", input: { creatorId: "creator", cursor: "" } },
	{ operation: "search_categories", input: { creatorId: "creator", query: "" } },
	{ operation: "search_categories", input: { creatorId: "creator", query: "chat", limit: 41 } },
])("rejects invalid operation inputs %j", async (body) => {
	expect((await handleConnectedAppRequest(request(body))).status).toBe(400);
	expect(search).not.toHaveBeenCalled();
});
it("bounds request bytes and rejects malformed JSON", async () => {
	expect((await handleConnectedAppRequest(request("x".repeat(9000)))).status).toBe(413);
	const r = request();
	const broken = new Request(r.url, { method: "POST", headers: r.headers, body: "{" });
	expect((await handleConnectedAppRequest(broken)).status).toBe(400);
});
it("returns safe grant, rate-limit and unavailable outcomes", async () => {
	const { ConnectedAppError } = await import("@/server/connected-apps/grants");
	for (const [code, status] of [
		["ACCESS_DENIED", 403],
		["RATE_LIMITED", 429],
		["SERVICE_UNAVAILABLE", 503],
	] as const) {
		access.mockRejectedValueOnce(new ConnectedAppError(code, status));
		const response = await handleConnectedAppRequest(request());
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ ok: false, error: { code } });
	}
	access.mockRejectedValueOnce(new Error("private-database-secret"));
	const response = await handleConnectedAppRequest(request());
	expect(response.status).toBe(503);
	expect(await response.text()).not.toContain("secret");
});
it("does not execute a request when cryptographic verification fails", async () => {
	verify.mockRejectedValue(new Error("jwt-signature-invalid-private"));
	const response = await handleConnectedAppRequest(request());
	expect(response.status).toBe(401);
	expect(await response.text()).not.toContain("private");
	expect(access).not.toHaveBeenCalled();
});
it("stops an aborted body rather than waiting for upload completion", async () => {
	const abort = new AbortController();
	abort.abort();
	const r = new Request(resource, { method: "POST", headers: { Authorization: "Bearer scoped-machine", "Content-Type": "application/json" }, signal: abort.signal, body: new ReadableStream({ start() {} }), duplex: "half" } as RequestInit);
	expect((await handleConnectedAppRequest(r)).status).toBe(400);
	expect(search).not.toHaveBeenCalled();
});
it.each([
	["CONFLICT", 409],
	["INVALID_CURSOR", 400],
	["INVALID_INPUT", 400],
])("preserves expected search failure %s", async (code, status) => {
	search.mockRejectedValue(new Error(code));
	const response = await handleConnectedAppRequest(request());
	expect(response.status).toBe(status);
	expect(await response.json()).toEqual({ ok: false, error: { code } });
});
it("mounts the operation on the Node App Router route", async () => {
	const route = await import("@/app/api/connected-apps/route");
	expect(route.runtime).toBe("nodejs");
	expect((await route.POST(request())).status).toBe(200);
});

it.each(["resolve_clip", "get_clip_playback"])("dispatches %s only inside its explicit creator grant", async (operation) => {
	const r = await handleConnectedAppRequest(request({ operation, input: { creatorId: "creator", reference: "ClipA" } }));
	expect(r.status).toBe(200);
	expect(access).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", operation }), expect.any(Function));
	expect(readClip).toHaveBeenCalledWith("creator", "ClipA", operation === "get_clip_playback", expect.any(AbortSignal));
	expect(search).not.toHaveBeenCalled();
});
it("does not resolve a clip after the grant denies it", async () => {
	const { ConnectedAppError } = await import("@/server/connected-apps/grants");
	access.mockRejectedValueOnce(new ConnectedAppError("ACCESS_DENIED"));
	const r = await handleConnectedAppRequest(request({ operation: "get_clip_playback", input: { creatorId: "other", reference: "ClipA" } }));
	expect(r.status).toBe(403);
	expect(readClip).not.toHaveBeenCalled();
});
