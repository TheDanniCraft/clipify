import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const mode = process.argv[2];
	const now = new Date("2026-10-05T00:00:00Z");
	const ownId = "55a14977-cf49-4338-adbd-9d9d50178b83";
	const foreignId = "55a14977-cf49-4338-adbd-9d9d50178b84";
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,$1,$1),('foreign','Foreign','foreign@example.invalid',true,$1,$1)`, [now]);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',$1)`, [now]);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.oauth_client (id,client_id,name,client_secret,redirect_uris,created_at,metadata) VALUES ('client','client','Custom AI','private-client-secret',ARRAY['https://client.example/callback'],$1,$2)`, [now, JSON.stringify({ privateNote: "private-client-metadata" })]);
		for (const [id, actor] of [
			[ownId, "owner"],
			[foreignId, "foreign"],
		]) {
			await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at,revoked_at) VALUES ($1,$2,'client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['creator:read','overlay:read'],true,$3,NULL)`, [id, actor, new Date(now.getTime() + 3600000)]);
			await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [id]);
		}
		if (mode === "revoked") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=$1 WHERE id=$2", [now, ownId]);
		if (mode === "populated") {
			await fixture.pool.query("INSERT INTO overlays (owner_id,name,status,type) VALUES ('creator','Export overlay','active','All')");
			await fixture.pool.query("INSERT INTO playlists (owner_id,name) VALUES ('creator','Export playlist')");
			await fixture.pool.query("INSERT INTO billing_subscriptions (id,user_id,stripe_customer_id,status) VALUES ('export-subscription','creator','export-customer','active')");
			await fixture.pool.query("INSERT INTO c15t_subject (id,\"externalId\") VALUES ('export-subject','owner')");
		}
		if (mode === "expired") await fixture.pool.query("UPDATE mcp_connection_grants SET expires_at=$1 WHERE id=$2", [now, ownId]);
		if (mode === "unnamed") await fixture.pool.query("UPDATE auth.oauth_client SET name=NULL WHERE client_id='client'");
		if (mode === "empty") await fixture.pool.query("DELETE FROM mcp_connection_grants WHERE auth_user_id='owner'");
		const { collectComprehensiveAccountData } = await import("@/server/account-lifecycle/account-data-export");
		const exported = await collectComprehensiveAccountData({ authUserId: "owner", creatorId: "creator", organizationId: "creator-org", now });
		const serialized = JSON.stringify(exported);
		const section = (exported as { mcp?: unknown }).mcp ?? null;
		const data = exported as { content: { overlays: unknown[]; playlists: unknown[] }; billing: { subscriptions: unknown[] }; privacy: { subjects: unknown[] } };
		console.log(JSON.stringify({ mcp: section, resourceCounts: { overlays: data.content.overlays.length, playlists: data.content.playlists.length, subscriptions: data.billing.subscriptions.length, subjects: data.privacy.subjects.length }, leaksPrivateClientData: serialized.includes("private-client-secret") || serialized.includes("private-client-metadata"), leaksForeignGrant: serialized.includes(foreignId), ownId, now: now.toISOString() }));
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
