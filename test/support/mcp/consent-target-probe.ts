import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createHash, randomUUID } from "node:crypto";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins } from "@/auth/mcp-options";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-consent-target-budget-secret-32chars";
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.BETTER_AUTH_SECRET = "isolated-consent-target-secret-32chars";
	const origin = "http://127.0.0.1:3107";
	process.env.NEXT_PUBLIC_BASE_URL = origin;
	process.env.MCP_ENABLED = "true";
	try {
		const { approveMcpConsent, providerGrantOptions } = await import("@/server/mcp/grants");
		const auth = betterAuth({ baseURL: origin, secret: process.env.BETTER_AUTH_SECRET, database: drizzleAdapter(fixture.db, { provider: "pg", schema }), emailAndPassword: { enabled: true }, plugins: createMcpPlugins({ origin, enabled: true, options: providerGrantOptions }) });
		const signup = await auth.api.signUpEmail({ body: { name: "Consent actor", email: "actor@example.invalid", password: "controlled-consent-password-123" }, asResponse: true });
		const actor = await signup.json();
		const cookie = signup.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		await fixture.pool.query(
			"INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('own-org','Owned','owned',now()),('foreign-org','Foreign','foreign',now()); INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('owned-creator','owned@example.invalid','Owned','','user','free'),('foreign-creator','foreign@example.invalid','Foreign','','user','free'); INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('owned-creator','own-org','active'),('foreign-creator','foreign-org','active')",
		);
		await fixture.pool.query("INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ($1,'own-org',$2,'owner',now())", [randomUUID(), actor.user.id]);
		const registration = await auth.handler(new Request(`${origin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Offline target test", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", application_type: "native" }) }));
		const client = await registration.json();
		const verifier = "controlled-pkce-verifier-at-least-43-characters-123456789";
		const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: "offline_access", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "offline-target-boundary", resource: `${origin}/mcp` });
		const authorization = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers: { Cookie: cookie } }));
		const location = authorization.headers.get("location");
		if (!location) throw new Error("Consent target fixture failed before signed state");
		if (process.argv[2] === "native-query") {
			const { verifyOAuthQueryParams } = await import("@better-auth/oauth-provider");
			const signed = new URL(location, origin).search.slice(1);
			const changed = new URLSearchParams(signed);
			changed.set("scope", "overlay:delete");
			const duplicate = new URLSearchParams(signed);
			duplicate.append("sig", "untrusted");
			const expired = new URLSearchParams(signed);
			expired.set("exp", "1");
			console.log(JSON.stringify({ valid: await verifyOAuthQueryParams(signed, process.env.BETTER_AUTH_SECRET!), changed: await verifyOAuthQueryParams(changed.toString(), process.env.BETTER_AUTH_SECRET!), duplicate: await verifyOAuthQueryParams(duplicate.toString(), process.env.BETTER_AUTH_SECRET!), expired: await verifyOAuthQueryParams(expired.toString(), process.env.BETTER_AUTH_SECRET!) }));
			return;
		}
		if (process.argv[2] === "agency-catalogue") {
			console.log(JSON.stringify(await (await import("./consent-agency-catalogue")).runConsentAgencyCatalogue({ fixture, auth, actorId: actor.user.id, origin, cookie, query: new URL(location, origin).search.slice(1) })));
			return;
		}
		const result = await approveMcpConsent({ auth, origin, headers: new Headers({ Cookie: cookie, Origin: origin, "Content-Type": "application/json" }), oauthQuery: new URL(location, origin).search.slice(1), accept: true, scopes: ["offline_access"], creators: [{ creatorId: process.argv[2] === "foreign" ? "foreign-creator" : "owned-creator", agencyOrganizationId: null }] });
		const body = await result.json();
		const grants = await fixture.pool.query("SELECT active,scopes FROM mcp_connection_grants");
		console.log(JSON.stringify({ status: result.status, error: body.error, issuedCode: body.url ? new URL(body.url).searchParams.has("code") : false, grants: grants.rows }));
	} finally {
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
