import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { approveMcpConsent, resolveMcpGrant } from "@/server/mcp/grants";
import { listMcpConnections, revokeMcpConnection } from "@/server/mcp/connections";
import { getCreatorSummary } from "@/server/mcp/creators";
import type { createMcpPostgresFixture } from "./postgres";

type Tokens = { access_token: string; refresh_token: string };
type Input = {
	auth: Parameters<typeof approveMcpConsent>[0]["auth"];
	fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
	origin: string;
	client: { client_id: string; redirect_uris: string[] };
	cookie: string;
	headers: Headers;
	query: URLSearchParams;
	verifier: string;
	actorId: string;
	tokens: Tokens;
	mode: string;
};

/** One account/client has independent immutable grants, including overlapping approvals. */
export async function checkIndependentConnections(input: Input) {
	const { auth, fixture, origin, client, cookie, headers } = input;
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('second-org','Second creator','second-creator',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('second-creator','second@example.invalid','Second creator','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('second-creator','second-org','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'second-org',$2,'owner',now())", [randomUUID(), input.actorId]);
	const selections = [
		{ creatorId: "second-creator", scopes: ["creator:read", "offline_access"] },
		{ creatorId: "fixture-creator", scopes: ["creator:read", "overlay:read", "offline_access"] },
	];
	async function approve(selection: (typeof selections)[number]) {
		const query = new URLSearchParams(input.query);
		query.set("state", randomUUID());
		query.set("prompt", "consent");
		const authorization = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers: { Cookie: cookie } }));
		const oauthQuery = new URL(authorization.headers.get("location")!, origin).search.slice(1);
		const consent = await approveMcpConsent({ auth, origin, headers, oauthQuery, accept: true, scopes: selection.scopes, creators: [{ creatorId: selection.creatorId, agencyOrganizationId: null }] });
		assert.equal(consent.status, 200);
		const callback = new URL((await consent.json()).url);
		const response = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: callback.searchParams.get("code")!, code_verifier: input.verifier, resource: `${origin}/mcp` }) }));
		assert.equal(response.status, 200);
		return response.json() as Promise<Tokens>;
	}
	const additional = input.mode.includes("concurrent") ? await Promise.all(selections.map(approve)) : [await approve(selections[0]), await approve(selections[1])];
	const tokens = [input.tokens, ...additional];
	const claims = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
	const listed = await listMcpConnections({ auth, headers });
	assert.equal(listed.filter((grant) => grant.active).length, 3, "New approvals must leave every existing connection active");
	assert.equal(new Set(listed.map((grant) => grant.id)).size, 3);
	assert.ok(listed.every((grant) => grant.clientId === client.client_id));
	const expected = [{ creatorId: "fixture-creator", scopes: input.query.get("scope")!.split(" ") }, ...selections];
	async function verify(token: Tokens, index: number) {
		const payload = claims(token.access_token);
		assert.deepEqual(payload.scope.split(" ").sort(), [...expected[index].scopes].sort());
		const principal = await resolveMcpGrant(payload, fixture.db);
		assert.deepEqual(
			principal.creators?.map((creator) => creator.creatorId),
			[expected[index].creatorId],
		);
		assert.equal((await getCreatorSummary(principal, expected[index].creatorId, fixture.db)).id, expected[index].creatorId);
		const other = expected[index].creatorId === "fixture-creator" ? "second-creator" : "fixture-creator";
		await assert.rejects(getCreatorSummary(principal, other, fixture.db));
	}
	async function refresh(token: Tokens, status = 200) {
		const response = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: token.refresh_token, resource: `${origin}/mcp` }) }));
		assert.equal(response.status, status);
		return response.json() as Promise<Tokens>;
	}
	await Promise.all(tokens.map(verify));
	const refreshed = await Promise.all(tokens.map((token) => refresh(token)));
	for (let index = 0; index < tokens.length; index++) {
		assert.notEqual(refreshed[index].refresh_token, tokens[index].refresh_token);
		assert.equal(claims(refreshed[index].access_token).clipify_grant_id, claims(tokens[index].access_token).clipify_grant_id);
		await verify(refreshed[index], index);
	}
	const revokedIndex = input.mode.endsWith(":first") ? 0 : 2;
	const revokedId = claims(refreshed[revokedIndex].access_token).clipify_grant_id;
	const revoked = await revokeMcpConnection({ auth, headers, origin, grantId: revokedId });
	assert.equal(revoked.status, 200);
	await assert.rejects(resolveMcpGrant(claims(refreshed[revokedIndex].access_token), fixture.db));
	await refresh(refreshed[revokedIndex], 400);
	for (let index = 0; index < refreshed.length; index++) {
		if (index === revokedIndex) continue;
		await verify(refreshed[index], index);
		await verify(await refresh(refreshed[index]), index);
	}
	const remaining = await listMcpConnections({ auth, headers });
	assert.equal(remaining.filter((grant) => grant.active).length, 2);
	assert.equal(remaining.find((grant) => grant.id === revokedId)?.active, false);
	return { independentGrants: 3, activeAfterRevoke: 2, sameClient: true, isolatedCreatorsAndScopes: true, allRefreshed: true, revokedAccessAndRefreshDenied: true, otherConnectionsStillRefresh: true };
}
