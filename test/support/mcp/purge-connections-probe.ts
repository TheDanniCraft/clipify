import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
import { user, oauthClient, oauthAccessToken, oauthRefreshToken, oauthConsent } from "@/db/auth-schema";
import { mcpConnectionGrantsTable, auditEventsTable } from "@/db/schema";
import { purgeInactiveMcpConnections } from "@/server/mcp/connections";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
const origin = "https://clipify.example";
const auth = { api: { getSession: async () => ({ user: { id: "owner" } }) } };
const headers = new Headers({ origin });
let ids: string[];
before(async () => {
	fixture = await createMcpPostgresFixture();
});
after(async () => {
	await fixture?.close();
});
beforeEach(async () => {
	await fixture.pool.query('TRUNCATE auth."user", audit_events CASCADE');
	await fixture.db.insert(user).values(["owner", "other"].map((id) => ({ id, name: id, email: `${id}@example.invalid` })));
	await fixture.db.insert(oauthClient).values({ id: "client", clientId: "client", redirectUris: ["https://example.invalid/callback"] });
	ids = Array.from({ length: 5 }, () => randomUUID());
	const now = new Date(),
		future = new Date(Date.now() + 86400000),
		past = new Date(Date.now() - 86400000);
	for (let index = 0; index < ids.length; index++) {
		const id = ids[index],
			userId = index === 4 ? "other" : "owner";
		await fixture.db.insert(mcpConnectionGrantsTable).values({ id, authUserId: userId, clientId: "client", resource: `${origin}/mcp`, issuer: `${origin}/api/auth`, scopes: ["creator:read"], active: index !== 3, revokedAt: index === 2 ? past : null, expiresAt: index === 1 ? past : future });
		await fixture.db.insert(oauthRefreshToken).values({ id, token: `refresh-${id}`, userId, clientId: "client", referenceId: id, scopes: ["creator:read"], createdAt: now, expiresAt: future });
		await fixture.db.insert(oauthAccessToken).values({ id, token: `access-${id}`, userId, clientId: "client", referenceId: id, refreshId: id, scopes: ["creator:read"], createdAt: now, expiresAt: future });
		await fixture.db.insert(oauthConsent).values({ id, userId, clientId: "client", referenceId: id, scopes: ["creator:read"], createdAt: now, updatedAt: now });
		await fixture.db.insert(auditEventsTable).values({ actorUserId: userId, targetType: "mcp_connection", action: "sensitive-integration:mcp.get_creator", outcome: "success", correlationId: id, metadata: { grantId: id } });
	}
});
const purge = (overrides = {}) => purgeInactiveMcpConnections({ auth, headers, origin, client: fixture.db, ...overrides });
test("purge removes only owned inactive grants and their tokens while retaining the audit log", async () => {
	const response = await purge();
	assert.equal(response.status, 200);
	assert.deepEqual((await response.json()).purgedIds.sort(), ids.slice(1, 4).sort());
	for (const table of [mcpConnectionGrantsTable, oauthAccessToken, oauthRefreshToken, oauthConsent]) assert.deepEqual((await fixture.db.select().from(table)).map((row) => row.id).sort(), [ids[0], ids[4]].sort());
	assert.equal((await fixture.db.select().from(auditEventsTable)).length, 5);
	assert.deepEqual(await (await purge()).json(), { purgedIds: [] });
});
test("unauthenticated and cross-origin requests cannot purge connections", async () => {
	assert.equal((await purge({ headers: new Headers({ origin: "https://evil.example" }) })).status, 403);
	assert.equal((await purge({ auth: { api: { getSession: async () => null } } })).status, 401);
	assert.equal((await fixture.db.select().from(mcpConnectionGrantsTable)).length, 5);
});
test("failed token cleanup rolls back the entire purge", async () => {
	await fixture.pool.query(`CREATE FUNCTION auth.reject_purge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture cleanup failure'; END $$; CREATE TRIGGER reject_purge BEFORE DELETE ON auth.oauth_consent FOR EACH ROW EXECUTE FUNCTION auth.reject_purge();`);
	try {
		assert.equal((await purge()).status, 503);
		for (const table of [mcpConnectionGrantsTable, oauthAccessToken, oauthRefreshToken, oauthConsent]) assert.equal((await fixture.db.select().from(table)).length, 5);
	} finally {
		await fixture.pool.query("DROP TRIGGER reject_purge ON auth.oauth_consent; DROP FUNCTION auth.reject_purge();");
	}
});

test("individual removal retains other inactive connections and audit history", async () => {
	const response = await purge({ grantId: ids[1] });
	assert.deepEqual(await response.json(), { purgedIds: [ids[1]] });
	for (const table of [mcpConnectionGrantsTable, oauthAccessToken, oauthRefreshToken, oauthConsent]) assert.deepEqual((await fixture.db.select().from(table)).map((row) => row.id).sort(), [ids[0], ...ids.slice(2)].sort());
	assert.equal((await fixture.db.select().from(auditEventsTable)).length, 5);
});
test("individual removal cannot delete active, foreign, missing or invalid connections", async () => {
	await fixture.pool.query("UPDATE mcp_connection_grants SET active = false WHERE id = $1", [ids[4]]);
	for (const grantId of [ids[0], ids[4], randomUUID()]) assert.deepEqual(await (await purge({ grantId })).json(), { purgedIds: [] });
	for (const grantId of ["", "invalid", null]) assert.equal((await purge({ grantId })).status, 400);
	assert.equal((await fixture.db.select().from(mcpConnectionGrantsTable)).length, 5);
});
