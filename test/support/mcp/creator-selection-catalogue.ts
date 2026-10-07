import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";
import { approveMcpConsent } from "@/server/mcp/grants";

type Fixture = Awaited<ReturnType<typeof createMcpPostgresFixture>>;
export async function runCreatorSelectionCatalogue(input: { fixture: Fixture; auth: any; origin: string; token: string; claims: Record<string, any>; headers: Headers; query: URLSearchParams; verifier: string; scopes: string[]; actorId: string }) {
	const { fixture, auth, origin } = input;
	const extra = "second-owned-creator";
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('second-owned-org','Second owned','second-owned-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('second-owned-creator','second-owned@example.invalid','Second owned','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('second-owned-creator','second-owned-org','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'second-owned-org',$2,'owner',now())", [randomUUID(), input.actorId]);
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("Creator selection fixture attempted unexpected external I/O");
		return auth.handler(request);
	}) as typeof fetch;
	let sequence = 0;
	async function call(token: string, name: string, args: Record<string, unknown>) {
		const response = await route.POST(new Request(`${origin}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method: "tools/call", params: { name, arguments: args } }) }));
		const text = await response.text();
		const data =
			text.startsWith("event:") || text.startsWith("data:")
				? text
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: text;
		const body = data ? JSON.parse(data) : null;
		return { status: response.status, result: body?.result?.structuredContent, error: body?.error, challenge: response.headers.get("WWW-Authenticate") };
	}
	try {
		const initialList = await call(input.token, "list_creators", {});
		const initialRead = await call(input.token, "get_capabilities", { creatorId: "fixture-creator" });
		const unapproved = await call(input.token, "get_capabilities", { creatorId: extra });
		const missing = await call(input.token, "get_capabilities", {});
		const initialCreators = (await fixture.pool.query("SELECT creator_id FROM mcp_grant_creators WHERE grant_id=$1 ORDER BY creator_id", [input.claims.clipify_grant_id])).rows.map((row) => row.creator_id);
		const query = new URLSearchParams(input.query);
		query.set("prompt", "consent");
		const authorization = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers: input.headers }));
		const location = authorization.headers.get("location");
		if (!location) throw new Error("Expanded creator fixture did not reach provider consent");
		const signedQuery = new URL(location, origin).search.slice(1);
		const consent = await approveMcpConsent({
			auth,
			origin,
			headers: input.headers,
			oauthQuery: signedQuery,
			accept: true,
			scopes: input.scopes,
			creators: [
				{ creatorId: "fixture-creator", agencyOrganizationId: null },
				{ creatorId: extra, agencyOrganizationId: null },
			],
		});
		const result = await consent.json();
		if (!consent.ok || typeof result.url !== "string") throw new Error("Expanded creator consent fixture failed");
		const callback = new URL(result.url);
		const exchange = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: query.get("client_id")!, redirect_uri: query.get("redirect_uri")!, code: callback.searchParams.get("code")!, code_verifier: input.verifier, resource: `${origin}/mcp` }) }));
		const tokens = await exchange.json();
		if (!exchange.ok || typeof tokens.access_token !== "string") throw new Error("Expanded creator token fixture failed");
		const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
		const expandedList = await call(tokens.access_token, "list_creators", {});
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('third-owned-org','Third owned','third-owned-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('third-owned-creator','third-owned@example.invalid','Third owned','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('third-owned-creator','third-owned-org','active')");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'third-owned-org',$2,'owner',now())", [randomUUID(), input.actorId]);
		const afterThirdOwnership = await call(tokens.access_token, "list_creators", {});
		const thirdSelection = await call(tokens.access_token, "get_capabilities", { creatorId: "third-owned-creator" });
		const firstSelection = await call(tokens.access_token, "get_capabilities", { creatorId: "fixture-creator" });
		const secondSelection = await call(tokens.access_token, "get_capabilities", { creatorId: extra });
		const oldAccess = await call(input.token, "list_creators", {});
		const expandedCreators = (await fixture.pool.query("SELECT creator_id FROM mcp_grant_creators WHERE grant_id=$1 ORDER BY creator_id", [claims.clipify_grant_id])).rows.map((row) => row.creator_id);
		await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='second-owned-org' AND user_id=$1", [input.actorId]);
		const afterRemoval = await call(tokens.access_token, "list_creators", {});
		const removedSelection = await call(tokens.access_token, "get_capabilities", { creatorId: extra });
		const approvalsAfterRemoval = (await fixture.pool.query("SELECT creator_id FROM mcp_grant_creators WHERE grant_id=$1 ORDER BY creator_id", [claims.clipify_grant_id])).rows.map((row) => row.creator_id);
		return { initialList, initialRead, unapproved, missing, initialCreators, consentStatus: consent.status, tokenStatus: exchange.status, distinctGrant: claims.clipify_grant_id !== input.claims.clipify_grant_id, generation: claims.clipify_grant_generation, subjectBound: claims.sub === input.actorId, expandedList, afterThirdOwnership, thirdSelection, firstSelection, secondSelection, oldAccess, expandedCreators, afterRemoval, removedSelection, approvalsAfterRemoval };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
