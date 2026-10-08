/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: {} }));
let connections: any;
try {
	connections = require("@/server/mcp/connections");
} catch {}
const actor = "actor",
	id = "7e16e441-1a14-4556-8d2f-a253198116ad";
const grant = { id, authUserId: actor, clientId: "client", scopes: ["creator:read"], active: true, revokedAt: null, expiresAt: new Date(Date.now() + 60000) };
function fixture(rows: unknown[] = [grant], failCleanup = false, failRevoke = false) {
	const update = jest.fn(() => ({ set: () => ({ where: jest.fn(async () => []) }) }));
	const tx = { select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => rows }) }) }) }), update, delete: () => ({ where: async () => [] }) };
	let calls = 0;
	const client = {
		transaction: jest.fn(async (callback) => {
			calls++;
			if ((calls === 1 && failRevoke) || (calls === 2 && failCleanup)) throw new Error("database unavailable");
			return callback(tx);
		}),
	};
	const auth = { api: { getSession: jest.fn(async () => ({ user: { id: actor } })) } };
	return { client, auth, update };
}
const headers = new Headers({ origin: "https://clipify.example" });
describe("TDD-US1-024 revoke authority and failures", () => {
	test("foreign grant is indistinguishable from missing and is never changed", async () => {
		expect(connections?.revokeMcpConnection).toEqual(expect.any(Function));
		const f = fixture([{ ...grant, authUserId: "other" }]);
		const response = await connections.revokeMcpConnection({ ...f, headers, origin: "https://clipify.example", grantId: id });
		expect(response.status).toBe(404);
		expect(f.update).not.toHaveBeenCalled();
	});
	test("cross-origin revoke never enters a transaction", async () => {
		expect(connections?.revokeMcpConnection).toEqual(expect.any(Function));
		const f = fixture();
		const response = await connections.revokeMcpConnection({ ...f, headers: new Headers({ origin: "https://evil.example" }), origin: "https://clipify.example", grantId: id });
		expect(response.status).toBe(403);
		expect(f.client.transaction).not.toHaveBeenCalled();
	});
	test("durable revoke failure reports failure and skips provider cleanup", async () => {
		expect(connections?.revokeMcpConnection).toEqual(expect.any(Function));
		const f = fixture([grant], false, true);
		const response = await connections.revokeMcpConnection({ ...f, headers, origin: "https://clipify.example", grantId: id });
		expect(response.status).toBe(503);
		expect(f.client.transaction).toHaveBeenCalledTimes(1);
	});
	test("provider cleanup failure reports revoked authority and a retryable pending cleanup", async () => {
		expect(connections?.revokeMcpConnection).toEqual(expect.any(Function));
		const f = fixture([grant], true);
		const response = await connections.revokeMcpConnection({ ...f, headers, origin: "https://clipify.example", grantId: id });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ revoked: true, cleanupPending: true });
		expect(f.update).toHaveBeenCalled();
	});
	test("unauthenticated caller cannot revoke", async () => {
		expect(connections?.revokeMcpConnection).toEqual(expect.any(Function));
		const f = fixture();
		f.auth.api.getSession.mockResolvedValue(null as any);
		const response = await connections.revokeMcpConnection({ ...f, headers, origin: "https://clipify.example", grantId: id });
		expect(response.status).toBe(401);
		expect(f.client.transaction).not.toHaveBeenCalled();
	});
});

test("connection listing rejects an absent session before querying data", async () => {
	const f = fixture();
	f.auth.api.getSession.mockResolvedValue(null as any);
	await expect(connections.listMcpConnections({ ...f, headers })).rejects.toThrow("AUTHENTICATION_REQUIRED");
});
test("legacy creator permissions inherit operation scopes but exclude refresh permission", async () => {
	const { mcpConnectionGrantsTable, mcpGrantCreatorsTable } = require("@/db/schema");
	const { oauthClient } = require("@/db/auth-schema");
	const row = { ...grant, scopes: ["creator:read", "offline_access"], createdAt: new Date(), revokedAt: null };
	const client = { select: () => ({ from: (table: unknown) => ({ where: () => (table === mcpConnectionGrantsTable ? { orderBy: async () => [row] } : table === oauthClient ? { limit: async () => [] } : table === mcpGrantCreatorsTable ? Promise.resolve([{ creatorId: "creator", scopes: null }]) : Promise.reject(new Error("Unexpected table"))) }) }) };
	const f = fixture();
	const result = await connections.listMcpConnections({ auth: f.auth, headers, client });
	expect(result).toMatchObject([{ clientName: "client", active: true, creatorPermissions: [{ creatorId: "creator", scopes: ["creator:read"] }] }]);
});
