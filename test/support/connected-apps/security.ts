import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixtureDatabase, fixtureOrigin, fixtureCreator } from "./environment";

async function main() {
	const database = fixtureDatabase();
	const [clientId, clientSecret, grantId, adminCookie, viewerCookie] = await Promise.all(["client_id", "client_secret", "grant_id", "admin_cookie", "viewer_cookie"].map((name) => readFile(`/fixture-secrets/${name}`, "utf8")));
	const headers = { "Content-Type": "application/json", Origin: fixtureOrigin, Cookie: adminCookie };
	const admin = (body: unknown, cookie = adminCookie, origin = fixtureOrigin) => fetch(`${fixtureOrigin}/api/connected-apps/admin`, { method: "POST", headers: { ...headers, Cookie: cookie, Origin: origin }, body: JSON.stringify(body) });
	if (process.argv[2] === "revoke") {
		assert.equal((await admin({ action: "revoke", grantId })).status, 200);
		console.log(JSON.stringify({ ok: true }));
		return;
	}
	const tokenResponse = (secret = clientSecret, resource = `${fixtureOrigin}/api/connected-apps`) => fetch(`${fixtureOrigin}/api/auth/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", scope: "creator:read", resource }) });
	const minted = await tokenResponse();
	assert.equal(minted.status, 200);
	const token = (await minted.json()).access_token;
	assert.equal(typeof token, "string");
	const [encodedHeader, encodedClaims] = token.split(".");
	const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
	assert.equal(claims.sub, clientId);
	assert.equal(claims.client_id, clientId);
	assert.equal(claims.clipify_application, true);
	assert.equal(claims.scope, "creator:read");
	assert.equal(claims.aud, `${fixtureOrigin}/api/connected-apps`);
	assert.equal(claims.iss, `${fixtureOrigin}/api/auth`);
	const call = (body: unknown = { operation: "search_clips", input: { creatorId: fixtureCreator } }, credential: string | null = token) => fetch(`${fixtureOrigin}/api/connected-apps`, { method: "POST", headers: { "Content-Type": "application/json", ...(credential === null ? {} : { Authorization: `Bearer ${credential}` }) }, body: JSON.stringify(body) });
	assert.equal((await call(undefined, null)).status, 401);
	const signature = token.split(".")[2];
	assert.equal((await call(undefined, `${encodedHeader}.${encodedClaims}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`)).status, 401);
	assert.equal((await call({ operation: "search_clips", input: { creatorId: "999999999" } })).status, 403);
	assert.equal((await call({ operation: "delete_creator", input: { creatorId: fixtureCreator } })).status, 400);
	assert.equal((await call({ operation: "search_clips", input: { creatorId: fixtureCreator, limit: 101 } })).status, 400);
	assert.equal((await tokenResponse("incorrect-client-secret")).status, 401);
	assert.ok((await tokenResponse(clientSecret, `${fixtureOrigin}/mcp`)).status >= 400);
	assert.equal((await admin({ action: "revoke", grantId }, viewerCookie)).status, 403);
	assert.equal((await admin({ action: "revoke", grantId }, adminCookie, "https://foreign.invalid")).status, 403);
	assert.equal((await admin({ action: "revoke", grantId }, "")).status, 403);
	const registration = await fetch(`${fixtureOrigin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Untrusted service", redirect_uris: ["https://untrusted.invalid/callback"], grant_types: ["client_credentials"], token_endpoint_auth_method: "client_secret_basic", scope: "creator:read" }) });
	assert.equal(registration.status, 400);
	const { Pool } = await import("pg");
	const pool = new Pool({ connectionString: database.href });
	try {
		const [grant] = (await pool.query("SELECT expires_at FROM connected_app_grants WHERE id=$1", [grantId])).rows;
		await pool.query("UPDATE connected_app_grants SET expires_at=now()-interval '1 second' WHERE id=$1", [grantId]);
		try {
			assert.equal((await call()).status, 403);
		} finally {
			await pool.query("UPDATE connected_app_grants SET expires_at=$2 WHERE id=$1", [grantId, grant.expires_at]);
		}
		await pool.query("UPDATE connected_app_grants SET operations='{}' WHERE id=$1", [grantId]);
		try {
			assert.equal((await call()).status, 403);
		} finally {
			await pool.query("UPDATE connected_app_grants SET operations=ARRAY['search_clips'] WHERE id=$1", [grantId]);
		}
		await pool.query("UPDATE auth.oauth_client SET disabled=true WHERE client_id=$1", [clientId]);
		try {
			assert.equal((await call()).status, 403);
		} finally {
			await pool.query("UPDATE auth.oauth_client SET disabled=false WHERE client_id=$1", [clientId]);
		}
		await pool.query("UPDATE users SET disabled=true WHERE id=$1", [fixtureCreator]);
		try {
			assert.equal((await call()).status, 403);
		} finally {
			await pool.query("UPDATE users SET disabled=false WHERE id=$1", [fixtureCreator]);
		}
		const result = await call();

		assert.equal(result.status, 200);
		const search = await result.json();
		assert.equal(search.data.items.length, 3);
		assert.ok(search.data.items.every((item: { broadcasterId: string }) => item.broadcasterId === fixtureCreator));
		const creatorSessions = await pool.query("SELECT count(*)::integer AS count FROM auth.account WHERE provider_id='twitch' AND account_id=$1", [fixtureCreator]);
		assert.equal(creatorSessions.rows[0].count, 0);
		const audit = await pool.query("SELECT actor_user_id,metadata FROM audit_events WHERE action='connected-app.search_clips' ORDER BY occurred_at DESC LIMIT 1");
		assert.equal(audit.rows[0].actor_user_id, null);
		assert.equal(audit.rows[0].metadata.clientId, clientId);
		assert.equal(audit.rows[0].metadata.creatorId, fixtureCreator);
	} finally {
		await pool.end();
	}
	console.log(JSON.stringify({ ok: true, checks: ["signed-machine-token", "missing-token", "forged-signature", "foreign-creator", "unregistered-operation", "invalid-input", "wrong-client-secret", "wrong-resource", "non-admin", "cross-origin-admin", "anonymous-admin", "public-machine-registration", "expired-grant", "operation-ceiling", "disabled-client", "disabled-creator", "no-creator-login", "application-audit"] }));
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
