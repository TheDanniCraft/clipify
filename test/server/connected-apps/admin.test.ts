/** @jest-environment node */
const requireAdmin = jest.fn();
const create = jest.fn();
const remove = jest.fn();
const insert = jest.fn();
const update = jest.fn();
let rows: unknown[] = [];
const query = { from: () => query, innerJoin: () => query, leftJoin: () => query, where: () => query, limit: async () => rows };
const tx = {
	select: () => query,
	insert: () => ({
		values: (value: unknown) => {
			insert(value);
			return { returning: async () => [{ id: "11111111-1111-4111-8111-111111111111" }] };
		},
	}),
	update: () => ({
		set: (value: unknown) => {
			update(value);
			return { where: () => ({ returning: async () => rows }) };
		},
	}),
};
jest.mock("@/db/client", () => ({ db: { select: () => query, transaction: (fn: (tx: unknown) => unknown) => fn(tx) } }));
jest.mock("@/auth/config", () => ({ auth: { api: { adminCreateOAuthClient: (...args: unknown[]) => create(...args), adminDeleteOAuthClient: (...args: unknown[]) => remove(...args) } } }));
jest.mock("@/server/connected-apps/oauth-policy", () => ({ CONNECTED_APP_SCOPE: "creator:read", connectedAppResource: (origin: string) => `${origin}/api/connected-apps`, requireConnectedAppAdmin: (...args: unknown[]) => requireAdmin(...args) }));
jest.mock("@/app/lib/baseUrl", () => ({ resolveBaseUrl: () => new URL("https://clipify.test") }));
const capture = jest.fn();
jest.mock("@/app/lib/sentryServer", () => ({ captureUnexpectedError: (...args: unknown[]) => capture(...args) }));
import { connectionOperations, untilRevokedExpiry, untilRevokedValue } from "@/server/connected-apps/admin-input";
import { handleConnectedAppAdminRequest } from "@/server/connected-apps/admin";
const provision = () => ({ action: "provision", name: "Babbler Awards", creatorId: "creator", expiresAt: new Date(Date.now() + 3600000).toISOString() });
const request = (body: unknown = provision(), origin = "https://clipify.test") => new Request("https://clipify.test/api/connected-apps/admin", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: "real-admin-session" }, body: JSON.stringify(body) });
beforeEach(() => {
	capture.mockReset();
	requireAdmin.mockReset().mockResolvedValue({ authUserId: "admin", sessionId: "session" });
	create.mockReset().mockResolvedValue({ client_id: "app", client_secret: "private-once" });
	insert.mockReset();
	update.mockReset();
	remove.mockReset().mockResolvedValue({ success: true });
	rows = [{ id: "creator", disabled: false, status: "active", subject: "owner-subject" }];
});
it("denies unauthorised administrators before provisioning credentials", async () => {
	requireAdmin.mockRejectedValue(new Error("ACCESS_DENIED"));
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(403);
	expect(create).not.toHaveBeenCalled();
	expect(insert).not.toHaveBeenCalled();
});
it("requires a recently authenticated administrator for provisioning", async () => {
	requireAdmin.mockRejectedValue(new Error("RECENT_AUTH_REQUIRED"));
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ ok: false, error: { code: "RECENT_AUTH_REQUIRED" } });
	expect(create).not.toHaveBeenCalled();
});
it("provisions only machine clip-search access for an enabled creator and real admin", async () => {
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(201);
	expect(requireAdmin).toHaveBeenCalledWith(expect.any(Headers), true);
	expect(await response.json()).toMatchObject({ ok: true, data: { clientId: "app", clientSecret: "private-once", grantId: expect.any(String) } });
	expect(create).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.any(Headers), body: expect.objectContaining({ grant_types: ["client_credentials"], client_credentials_scopes: ["creator:read"], scope: "creator:read", resources: ["https://clipify.test/api/connected-apps"] }) }));
	expect(create.mock.calls[0][0].body).not.toHaveProperty("redirect_uris");
	expect(insert).toHaveBeenCalledWith(expect.objectContaining({ clientId: "app", creatorId: "creator", operations: ["search_clips"], provisionedBy: "admin" }));
	expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("provisions clip access until an administrator revokes it", async () => {
	const response = await handleConnectedAppAdminRequest(request({ ...provision(), expiresAt: untilRevokedValue }));
	expect(response.status).toBe(201);
	expect(insert).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: new Date(untilRevokedExpiry) }));
	expect(await response.json()).toMatchObject({ ok: true, data: { expiresAt: untilRevokedExpiry } });
});
it.each([
	{ label: "missing", creators: [] },
	{ label: "disabled", creators: [{ id: "creator", disabled: true, status: "active" }] },
	{ label: "suspended", creators: [{ id: "creator", disabled: false, status: "suspended" }] },
])("refuses $label creators", async (value) => {
	rows = value.creators;
	expect((await handleConnectedAppAdminRequest(request())).status).toBe(403);
	expect(create).not.toHaveBeenCalled();
});
it("refuses foreign origins and malformed or overlong authorisation", async () => {
	expect((await handleConnectedAppAdminRequest(request(provision(), "https://evil.test"))).status).toBe(403);
	for (const body of [
		{ ...provision(), operations: ["delete_creator"] },
		{ ...provision(), expiresAt: new Date(0).toISOString() },
		{ ...provision(), expiresAt: new Date(Date.now() + 91 * 86400000).toISOString() },
		{ ...provision(), name: "" },
	])
		expect((await handleConnectedAppAdminRequest(request(body))).status).toBe(400);
	expect(create).not.toHaveBeenCalled();
});
it("revokes a known grant with an audit and returns not-found for an unknown grant", async () => {
	rows = [{ id: "grant", creatorId: "creator", clientId: "app" }];
	const response = await handleConnectedAppAdminRequest(request({ action: "revoke", grantId: "11111111-1111-4111-8111-111111111111" }));
	expect(response.status).toBe(200);
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
	rows = [];
	expect((await handleConnectedAppAdminRequest(request({ action: "revoke", grantId: "11111111-1111-4111-8111-111111111111" }))).status).toBe(404);
});
it("redacts provider and database failures", async () => {
	create.mockRejectedValue(new Error("private-once"));
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(503);
	expect(await response.text()).not.toContain("private-once");
});

it("removes an issued client when saving its authorisation fails", async () => {
	insert.mockImplementationOnce(() => {
		throw new Error("private-database");
	});
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(503);
	expect(remove).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.any(Headers), body: { client_id: "app" } }));
	expect(await response.text()).not.toContain("private");
});
it("mounts admin provisioning on the Node App Router route", async () => {
	const route = await import("@/app/api/connected-apps/admin/route");
	expect(route.runtime).toBe("nodejs");
	expect((await route.POST(request())).status).toBe(201);
});

it("retains a safe failure if compensating client deletion is unavailable", async () => {
	insert.mockImplementationOnce(() => {
		throw new Error("private-db");
	});
	remove.mockRejectedValueOnce(new Error("private-provider"));
	const response = await handleConnectedAppAdminRequest(request());
	expect(response.status).toBe(503);
	expect(await response.text()).not.toMatch(/private/);
	expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: "Connected application provisioning cleanup failed" }), "connected-apps", "cleanup-client");
});

it("grants only explicitly selected read operations", async () => {
	const response = await handleConnectedAppAdminRequest(request({ ...provision(), operations: ["resolve_clip", "get_clip_playback"] }));
	expect(response.status).toBe(201);
	expect(insert).toHaveBeenCalledWith(expect.objectContaining({ operations: ["resolve_clip", "get_clip_playback"] }));
});
it.each([{ operations: [] }, { operations: ["search_clips", "search_clips"] }, { operations: ["delete_creator"] }])("rejects invalid operation selection $operations", async ({ operations }) => {
	expect((await handleConnectedAppAdminRequest(request({ ...provision(), operations }))).status).toBe(400);
	expect(create).not.toHaveBeenCalled();
});
it.each(["http://app.test/callback", "https://user:pass@app.test/callback", "https://app.test/callback#fragment", "https://app.test/callback?next=evil", "https://*.test/callback", "https://app.test/%2A"])("rejects unsafe callback %s", async (callbackUrl) => {
	expect((await handleConnectedAppAdminRequest(request({ ...provision(), callbackUrl }))).status).toBe(400);
	expect(create).not.toHaveBeenCalled();
});

it("creates a separate PKCE sign-in client with an exact callback and returns both secrets once", async () => {
	create.mockResolvedValueOnce({ client_id: "machine", client_secret: "machine-once" }).mockResolvedValueOnce({ client_id: "login", client_secret: "login-once" });
	const response = await handleConnectedAppAdminRequest(request({ ...provision(), callbackUrl: "https://app.test/api/auth/callback/clipify" }));
	expect(response.status).toBe(201);
	expect(create.mock.calls[1][0].body).toMatchObject({ grant_types: ["authorization_code"], scope: "openid profile email", require_pkce: true, redirect_uris: ["https://app.test/api/auth/callback/clipify"], resources: ["https://clipify.test/api/auth/oauth2/userinfo"] });
	expect(create.mock.calls[1][0].body).not.toHaveProperty("client_credentials_scopes");
	expect(await response.json()).toMatchObject({ data: { clientSecret: "machine-once", identity: { clientId: "login", clientSecret: "login-once" } } });
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.anything() }));
	expect(JSON.stringify(insert.mock.calls)).not.toMatch(/machine-once|login-once/);
});
it("removes the machine client if creating the sign-in client fails", async () => {
	create.mockResolvedValueOnce({ client_id: "machine", client_secret: "machine-once" }).mockRejectedValueOnce(Error("private-provider"));
	expect((await handleConnectedAppAdminRequest(request({ ...provision(), callbackUrl: "https://app.test/callback" }))).status).toBe(503);
	expect(remove).toHaveBeenCalledWith(expect.objectContaining({ body: { client_id: "machine" } }));
});

it("disables both clients when revoking a paired connection", async () => {
	rows = [{ id: "grant", creatorId: "creator", clientId: "machine", metadata: { connectedAppIdentityClientId: "login" } }];
	const response = await handleConnectedAppAdminRequest(request({ action: "revoke", grantId: "11111111-1111-4111-8111-111111111111" }));
	expect(response.status).toBe(200);
	expect(update).toHaveBeenCalledWith({ disabled: true });
	expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: "connected-app.revoke" }));
});
it("removes both issued clients if saving the paired grant fails", async () => {
	create.mockResolvedValueOnce({ client_id: "machine", client_secret: "machine-once" }).mockResolvedValueOnce({ client_id: "login", client_secret: "login-once" });
	insert.mockImplementationOnce(() => {
		throw Error("database unavailable");
	});
	expect((await handleConnectedAppAdminRequest(request({ ...provision(), callbackUrl: "https://app.test/callback" }))).status).toBe(503);
	expect(remove.mock.calls.map(([input]) => input.body.client_id)).toEqual(["machine", "login"]);
});
it("refuses sign-in provisioning without a linked creator identity", async () => {
	rows = [{ id: "creator", disabled: false, status: "active" }];
	expect((await handleConnectedAppAdminRequest(request({ ...provision(), callbackUrl: "https://app.test/callback" }))).status).toBe(403);
	expect(create).not.toHaveBeenCalled();
});

it.each(connectionOperations)("provisions only the UI-offered permission %s when selected alone", async (operation) => {
	const response = await handleConnectedAppAdminRequest(request({ ...provision(), operations: [operation] }));
	expect(response.status).toBe(201);
	expect(insert).toHaveBeenCalledWith(expect.objectContaining({ operations: [operation] }));
	expect(create.mock.calls[0][0].body).toMatchObject({ grant_types: ["client_credentials"], scope: "creator:read", client_credentials_scopes: ["creator:read"] });
});
