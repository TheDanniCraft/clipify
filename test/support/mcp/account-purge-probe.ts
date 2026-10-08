import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const mode = process.argv[2];
	const now = new Date();
	const grantId = "55a14977-cf49-4338-adbd-9d9d50178b83";
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,$1,$1),('foreign','Foreign','foreign@example.invalid',true,$1,$1)`, [now]);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',$1),('foreign-org','Foreign','foreign-org',$1)`, [now]);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free'),('foreign','foreign-creator@example.invalid','Foreign','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active'),('foreign','foreign-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.oauth_client (id,client_id,name,redirect_uris,created_at) VALUES ('client','client','Custom AI',ARRAY['https://client.example/callback'],$1)`, [now]);
		await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'owner','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['creator:read'],true,$2)`, [grantId, new Date(now.getTime() + 3600000)]);
		await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [grantId]);
		await fixture.pool.query(`INSERT INTO mcp_mutation_retries (grant_id,grant_generation,auth_user_id,client_id,creator_id,tool_name,retry_key,input_digest,safe_response,resource_id,created_at,expires_at) VALUES ($1,1,'owner','client','creator','create_overlay','retry',$2,'{}','11111111-1111-4111-8111-111111111111',$3,$4)`, [grantId, "a".repeat(64), now, new Date(now.getTime() + 86400000)]);
		await fixture.pool.query(`INSERT INTO auth.oauth_refresh_token (id,token,client_id,user_id,reference_id,scopes,created_at,expires_at) VALUES ('refresh','private-fixture-refresh','client','owner',$1,ARRAY['creator:read'],$2,$3)`, [grantId, now, new Date(now.getTime() + 86400000)]);
		await fixture.pool.query(`INSERT INTO auth.oauth_access_token (id,token,client_id,user_id,reference_id,refresh_id,scopes,created_at,expires_at) VALUES ('access','private-fixture-access','client','owner',$1,'refresh',ARRAY['creator:read'],$2,$3)`, [grantId, now, new Date(now.getTime() + 3600000)]);
		await fixture.pool.query(`INSERT INTO auth.oauth_consent (id,client_id,user_id,reference_id,scopes,created_at,updated_at) VALUES ('consent','client','owner',$1,ARRAY['creator:read'],$2,$2)`, [grantId, now]);
		for (const [label, actor, creator, action] of [
			["own", "owner", "creator", "sensitive-integration:mcp.get_overlay"],
			["foreign", "foreign", "foreign", "sensitive-integration:mcp.get_overlay"],
			["billing", "owner", "creator", "billing.subscription.update"],
		]) {
			await fixture.pool.query(`INSERT INTO audit_events (actor_user_id,target_type,action,outcome,correlation_id,metadata,occurred_at) VALUES ($1,'creator',$2,'success',$3,$4,$5)`, [actor, action, label, JSON.stringify({ creatorId: creator }), now]);
		}
		if (mode === "actor") await fixture.pool.query(`DELETE FROM auth."user" WHERE id='owner'`);
		if (mode === "creator") await fixture.pool.query(`DELETE FROM users WHERE id='creator'`);
		if (mode === "suspended") await fixture.pool.query(`UPDATE creator_accounts SET status='suspended' WHERE creator_id='creator'`);
		const service = await import("@/server/mcp/cleanup");
		const deleted = await service.pruneMcpActivity({ now }, fixture.db);
		const remaining = (await fixture.pool.query("SELECT correlation_id FROM audit_events ORDER BY correlation_id")).rows.map((row) => row.correlation_id);
		const counts = (await fixture.pool.query(`SELECT (SELECT count(*) FROM mcp_connection_grants)::int AS grants,(SELECT count(*) FROM mcp_grant_creators)::int AS approvals,(SELECT count(*) FROM mcp_mutation_retries)::int AS retries,(SELECT count(*) FROM auth.oauth_access_token)::int AS access,(SELECT count(*) FROM auth.oauth_refresh_token)::int AS refresh,(SELECT count(*) FROM auth.oauth_consent)::int AS consents`)).rows[0];
		console.log(JSON.stringify({ deleted, remaining, counts }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
