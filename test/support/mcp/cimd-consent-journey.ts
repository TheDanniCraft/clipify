import { createHash, randomUUID } from "node:crypto";
import { approveMcpConsent } from "@/server/mcp/grants";
import type { createMcpPostgresFixture } from "./postgres";

export async function runCimdConsentJourney(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; clientId: string }) {
	const { fixture, auth, origin, clientId } = input;
	const signup = await auth.api.signUpEmail({ body: { name: "URL client actor", email: "url-client@example.invalid", password: "isolated-url-client-password-123" }, asResponse: true });
	const actor = await signup.json();
	const cookie = signup.headers
		.getSetCookie()
		.map((value: string) => value.split(";")[0])
		.join("; ");
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('url-creator-org','URL creator','url-creator-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('url-creator','url-creator@example.invalid','URL creator','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('url-creator','url-creator-org','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'url-creator-org',$2,'owner',now())", [randomUUID(), actor.user.id]);
	const verifier = "isolated-cimd-complete-verifier-at-least-43-characters-12345";
	const callback = "https://custom.example.invalid/callback";
	const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "creator:read", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: origin + "/mcp", state: "url-client-state" });
	const authorization = await auth.handler(new Request(origin + "/api/auth/oauth2/authorize?" + params, { headers: { Cookie: cookie } }));
	const location = authorization.headers.get("location");
	if (!location) throw new Error("CIMD_COMPLETE_AUTHORIZATION_UNAVAILABLE");
	const consent = await approveMcpConsent({ auth, origin, headers: new Headers({ Cookie: cookie, Origin: origin, "Content-Type": "application/json" }), oauthQuery: new URL(location, origin).search.slice(1), accept: true, scopes: ["creator:read"], creators: [{ creatorId: "url-creator", agencyOrganizationId: null }] });
	const approved = await consent.json();
	const code = approved.url ? new URL(approved.url).searchParams.get("code") : null;
	if (!code) throw new Error("CIMD_COMPLETE_CODE_UNAVAILABLE");
	const tokenResponse = await auth.handler(new Request(origin + "/api/auth/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: callback, code, code_verifier: verifier, resource: origin + "/mcp" }) }));
	const tokens = await tokenResponse.json();
	if (!tokens.access_token) throw new Error("CIMD_COMPLETE_TOKEN_UNAVAILABLE");
	const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
	const grant = (await fixture.pool.query("SELECT id,client_id,auth_user_id,generation,active FROM mcp_connection_grants WHERE id=$1", [claims.clipify_grant_id])).rows[0];
	const approvals = (await fixture.pool.query("SELECT creator_id FROM mcp_grant_creators WHERE grant_id=$1", [grant.id])).rows;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("CIMD_COMPLETE_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	try {
		const route = await import("@/app/mcp/route");
		const read = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_creators", arguments: {} } }) }));
		const body = await read.text();
		return { consentStatus: consent.status, tokenStatus: tokenResponse.status, readStatus: read.status, creatorRead: body.includes("url-creator"), clientBound: grant.client_id === clientId && (claims.client_id ?? claims.azp) === clientId, actorBound: grant.auth_user_id === actor.user.id && claims.sub === actor.user.id, active: grant.active, generation: grant.generation, approvedCreators: approvals.map((row) => row.creator_id), uuidGrant: /^[a-f0-9-]{36}$/.test(grant.id) };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
