import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createLocalJWKSet, jwtVerify } from "jose";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins } from "@/auth/mcp-options";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const origin = "http://127.0.0.1:3109";
	Object.assign(process.env, { DATABASE_URL: fixture.url, APP_ENV: "test", DISABLE_BACKGROUND_JOBS: "true", NEXT_PUBLIC_BASE_URL: origin, RATE_LIMIT_HASH_SECRET: "isolated-identity-budget-secret-32chars" });
	try {
		const { providerGrantOptions } = await import("@/server/mcp/grants");
		const auth = betterAuth({ baseURL: origin, secret: "isolated-identity-provider-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), emailAndPassword: { enabled: true }, plugins: createMcpPlugins({ origin, options: providerGrantOptions }) });
		const signup = await auth.api.signUpEmail({ body: { name: "Identity only", email: "identity@example.invalid", password: "controlled-identity-password-12345" }, asResponse: true });
		const actor = await signup.json();
		assert.ok(actor.user?.id);
		const cookie = signup.headers
			.getSetCookie()
			.map((v) => v.split(";")[0])
			.join("; ");
		const clientId = "identity-test";
		const callback = "http://127.0.0.1:49999/api/auth/callback/clipify";
		const resource = origin + "/api/auth/oauth2/userinfo";
		await fixture.db.insert(schema.oauthClient).values({ id: randomUUID(), clientId, name: "Awards identity fixture", redirectUris: [callback], scopes: ["openid", "profile", "email"], clientCredentialsScopes: [], grantTypes: ["authorization_code"], responseTypes: ["code"], tokenEndpointAuthMethod: "none", requirePKCE: true, skipConsent: true });
		const verifier = "identity-pkce-proof-at-least-43-characters-1234567890";
		const query = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "openid profile email", resource, nonce: "identity-test-nonce", state: "identity-test-state", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
		const request = (path: string, init?: RequestInit) => auth.handler(new Request(origin + "/api/auth" + path, init));
		const authorization = await request("/oauth2/authorize?" + query, { headers: { Cookie: cookie } });
		const destination =
			authorization.headers.get("location") ??
			(
				await authorization
					.clone()
					.json()
					.catch(() => ({}))
			).url;
		assert.ok(destination, `Authorization missing redirect (${authorization.status})`);
		const redirect = new URL(destination, origin);
		assert.equal(redirect.origin, new URL(callback).origin);
		assert.equal(redirect.pathname, new URL(callback).pathname);
		assert.equal(redirect.searchParams.get("state"), "identity-test-state");
		assert.ok(redirect.searchParams.get("code"));
		const tokenResponse = await request("/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: callback, code: redirect.searchParams.get("code")!, code_verifier: verifier, resource }) });
		const tokens = await tokenResponse.json();
		assert.equal(tokenResponse.status, 200, JSON.stringify(tokens));
		assert.ok(tokens.id_token);
		const jwks = await (await request("/jwks")).json();
		const verified = await jwtVerify(tokens.id_token, createLocalJWKSet(jwks), { issuer: origin + "/api/auth", audience: clientId });
		assert.equal(verified.payload.sub, actor.user.id);
		assert.equal(verified.payload.nonce, "identity-test-nonce");
		const userinfo = await request("/oauth2/userinfo", { headers: { Authorization: "Bearer " + tokens.access_token } });
		const identity = await userinfo.json();
		assert.equal(userinfo.status, 200, JSON.stringify(identity));
		assert.equal(identity.sub, actor.user.id);
		assert.equal(identity.email, "identity@example.invalid");
		assert.equal(identity.name, "Identity only");
		const bad = new URLSearchParams(query);
		bad.set("redirect_uri", "https://attacker.invalid/callback");
		const denied = await request("/oauth2/authorize?" + bad, { headers: { Cookie: cookie } });
		assert.ok(denied.status >= 400 || !denied.headers.get("location")?.startsWith("https://attacker.invalid"));
		const registration = await request("/oauth2/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirect_uris: [callback], scope: "openid profile email" }) });
		assert.equal(registration.status, 400);
		const grants = await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants");
		assert.equal(grants.rows[0].count, 0);
		console.log(JSON.stringify({ signedIdentity: true, userInfo: true, pkce: true, publicIdentityRegistrationDenied: true, noMcpGrant: true, foreignCallbackDenied: true }));
	} finally {
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
