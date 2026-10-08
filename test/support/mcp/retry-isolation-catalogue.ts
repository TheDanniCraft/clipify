import { createHash, randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";

export async function runRetryIsolationCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; actorId: string; cookie: string; client: any }) {
	const { fixture, auth, origin } = input;
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'; INSERT INTO auth.organization(id,name,slug,created_at) VALUES('retry-second-org','Second','retry-second',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('retry-second-creator','retry-second@example.invalid','Second creator','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('retry-second-creator','retry-second-org','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'retry-second-org',$2,'owner',now())", [randomUUID(), input.actorId]);
	const secondSignup = await auth.api.signUpEmail({ body: { name: "Second retry actor", email: "retry-actor@example.invalid", password: "isolated-retry-actor-password-123" }, asResponse: true });
	const secondActor = await secondSignup.json();
	const secondCookie = secondSignup.headers
		.getSetCookie()
		.map((part: string) => part.split(";")[0])
		.join("; ");
	for (const org of ["creator-org", "retry-second-org"]) await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,$2,$3,'owner',now())", [randomUUID(), org, secondActor.user.id]);
	const registered = await auth.handler(new Request(origin + "/api/auth/oauth2/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Second retry client", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) }));
	if (registered.status !== 201) throw new Error("Retry isolation registration failed");
	const secondClient = await registered.json();
	const { approveMcpConsent } = await import("@/server/mcp/grants");
	const issue = async (client: any, cookie: string) => {
		const verifier = "isolated-retry-context-pkce-verifier-at-least-43-chars-123";
		const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: "creator:read overlay:create playlist:create", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "retry-context", resource: origin + "/mcp" });
		const authorization = await auth.handler(new Request(origin + "/api/auth/oauth2/authorize?" + query, { headers: { Cookie: cookie } }));
		const location = authorization.headers.get("location");
		if (!location) throw new Error("Retry isolation signed authorization missing");
		const consent = await approveMcpConsent({ auth, origin, headers: new Headers({ Cookie: cookie, Origin: origin, "Content-Type": "application/json" }), oauthQuery: new URL(location, origin).search.slice(1), accept: true, scopes: ["creator:read", "overlay:create", "playlist:create"], creators: ["fixture-creator", "retry-second-creator"].map((creatorId) => ({ creatorId, agencyOrganizationId: null })) });
		const approved = await consent.json();
		if (!consent.ok || !approved.url) throw new Error("Retry isolation consent failed");
		const code = new URL(approved.url).searchParams.get("code");
		const exchange = await auth.handler(new Request(origin + "/api/auth/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: code!, code_verifier: verifier, resource: origin + "/mcp" }) }));
		const result = await exchange.json();
		if (!exchange.ok || !result.access_token) throw new Error("Retry isolation token failed");
		return result.access_token as string;
	};
	const baselineToken = await issue(input.client, input.cookie);
	const clientToken = await issue(secondClient, input.cookie);
	const actorToken = await issue(input.client, secondCookie);
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("RETRY_ISOLATION_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	let id = 0;
	const call = async (kind: string, token: string, creatorId: string) => {
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name: `create_${kind}`, arguments: { creatorId, retryKey: "same-textual-retry-key", name: "Independent intent" } } }) }));
		const wire = await response.text();
		const text =
			wire.startsWith("event:") || wire.startsWith("data:")
				? wire
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: wire;
		const body = text ? JSON.parse(text) : null;
		const result = body?.result?.structuredContent;
		return { status: response.status, id: result?.[kind]?.id ?? result?.id ?? null, creatorId: result?.[kind]?.creatorId ?? result?.creatorId ?? null, error: result?.error?.code ?? null, safe: ![baselineToken, clientToken, actorToken].some((value) => wire.includes(value)) && !/"(?:secret|access_token|refresh_token|ownerId)"\s*:/.test(wire) };
	};
	try {
		const outcomes = [];
		for (const kind of ["overlay", "playlist"]) {
			const baseline = await call(kind, baselineToken, "fixture-creator");
			for (const [context, token, creatorId] of [
				["client", clientToken, "fixture-creator"],
				["actor", actorToken, "fixture-creator"],
				["creator", baselineToken, "retry-second-creator"],
			]) {
				const created = await call(kind, token, creatorId);
				const replay = await call(kind, token, creatorId);
				outcomes.push({ kind, context, baseline, created, replay });
			}
		}
		const rows = (await fixture.pool.query("SELECT tool_name,client_id,auth_user_id,creator_id,resource_id FROM mcp_mutation_retries WHERE retry_key='same-textual-retry-key' ORDER BY tool_name,resource_id")).rows;
		return { outcomes, records: rows.length, resources: new Set(rows.map((row) => row.resource_id)).size, clients: new Set(rows.map((row) => row.client_id)).size, actors: new Set(rows.map((row) => row.auth_user_id)).size, creators: new Set(rows.map((row) => row.creator_id)).size };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
