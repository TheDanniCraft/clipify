import { randomUUID } from "node:crypto";
import { approveMcpConsent } from "@/server/mcp/grants";
import type { createMcpPostgresFixture } from "./postgres";

export async function runConsentAgencyCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; actorId: string; origin: string; cookie: string; query: string }) {
	const { fixture, actorId } = input;
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('consent-agency','Consent agency','consent-agency',now()),('foreign-agency','Foreign agency','foreign-agency',now())");
	const memberId = randomUUID();
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'consent-agency',$2,'operations',now())", [memberId, actorId]);
	await fixture.pool.query("INSERT INTO agency_creator_links(agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES('consent-agency','foreign-org','accepted','[\"creator:read\"]',$1,now())", [actorId]);
	const outcomes = [];
	for (const name of ["valid", "missing-agency", "foreign-agency", "removed-member", "revoked-link", "missing-ceiling", "duplicate-creator", "restored"]) {
		await fixture.pool.query("UPDATE agency_creator_links SET status='accepted',revoked_by=NULL,revoked_at=NULL,permission_ceiling='[\"creator:read\"]' WHERE agency_organization_id='consent-agency'");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'consent-agency',$2,'operations',now()) ON CONFLICT(id) DO NOTHING", [memberId, actorId]);
		if (name === "removed-member") await fixture.pool.query("DELETE FROM auth.member WHERE id=$1", [memberId]);
		if (name === "revoked-link") await fixture.pool.query("UPDATE agency_creator_links SET status='revoked',revoked_by=$1,revoked_at=now() WHERE agency_organization_id='consent-agency'", [actorId]);
		if (name === "missing-ceiling") await fixture.pool.query("UPDATE agency_creator_links SET permission_ceiling='[]' WHERE agency_organization_id='consent-agency'");
		const target = { creatorId: "foreign-creator", agencyOrganizationId: name === "missing-agency" ? null : name === "foreign-agency" ? "foreign-agency" : "consent-agency" };
		const before = (await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants")).rows[0].count;
		const response = await approveMcpConsent({ auth: input.auth, origin: input.origin, headers: new Headers({ Cookie: input.cookie, Origin: input.origin, "Content-Type": "application/json" }), oauthQuery: input.query, accept: true, scopes: ["offline_access"], creators: name === "duplicate-creator" ? [target, target] : [target] });
		const body = await response.json();
		const rows = (await fixture.pool.query("SELECT g.id,c.creator_id,c.agency_organization_id FROM mcp_connection_grants g JOIN mcp_grant_creators c ON c.grant_id=g.id WHERE g.active AND g.revoked_at IS NULL")).rows;
		const after = (await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants")).rows[0].count;
		outcomes.push({ name, status: response.status, issuedCode: typeof body.url === "string" && new URL(body.url).searchParams.has("code"), newGrants: after - before, currentCreators: rows.map((row) => ({ creatorId: row.creator_id, agencyOrganizationId: row.agency_organization_id })) });
	}
	const [current] = (await fixture.pool.query("SELECT id FROM mcp_connection_grants WHERE active AND revoked_at IS NULL")).rows;
	let uniqueEnforced = false;
	try {
		await fixture.pool.query("INSERT INTO mcp_grant_creators(grant_id,creator_id,agency_organization_id) VALUES($1,'foreign-creator','consent-agency')", [current.id]);
	} catch (error) {
		uniqueEnforced = (error as { code?: string }).code === "23505";
	}
	return { outcomes, uniqueEnforced };
}
