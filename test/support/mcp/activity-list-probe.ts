import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.BETTER_AUTH_SECRET = "isolated-activity-cursor-secret-32chars";
	const mode = process.argv[2],
		now = new Date("2026-10-05T00:00:00Z");
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,$1,$1),('viewer','Viewer','viewer@example.invalid',true,$1,$1)`, [now]);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',$1),('foreign-org','Private','foreign-org',$1)`, [now]);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free'),('foreign','foreign@example.invalid','Private creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active'),('foreign','foreign-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('owner','creator-org','owner','owner',$1),('viewer','creator-org','viewer',$2,$1)`, [now, mode === "analyst" || mode === "cross-actor-cursor" || mode === "free-team" ? "analyst" : "content-manager"]);
		await fixture.pool.query(`INSERT INTO auth.oauth_client (id,client_id,name,redirect_uris,created_at) VALUES ('client','client','Custom AI',ARRAY['https://client.example/callback'],$1)`, [now]);
		if (mode === "cross-creator-cursor") await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('foreign-owner','foreign-org','owner','owner',$1)`, [now]);
		if (mode === "analyst" || mode === "cross-actor-cursor") await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='creator'");
		const grant = "55a14977-cf49-4338-adbd-9d9d50178b83";
		await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'owner','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['creator:read'],true,$2)`, [grant, new Date(now.getTime() + 3600000)]);
		await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [grant]);
		for (const [id, creator, outcome, tool, time] of [
			["00000000-0000-4000-8000-000000000001", "creator", "success", "get_playlist", "2026-10-05T00:00:00.000001Z"],
			["00000000-0000-4000-8000-000000000002", null, "denied", "update_playlist", "2026-10-05T00:00:00.000002Z"],
			["00000000-0000-4000-8000-000000000003", "foreign", "success", "get_overlay", "2026-10-05T00:00:00.000003Z"],
		]) {
			const metadata = { clientId: "client", grantId: grant, generation: 1, tool, ...(creator ? { creatorId: creator } : {}), privatePayload: "private-payload-value", rawInput: { note: "private-token" } };
			await fixture.pool.query(`INSERT INTO audit_events (id,actor_user_id,target_type,action,outcome,reason,correlation_id,metadata,occurred_at) VALUES ($1,'owner','mcp_connection',$2,$3,$4,'fixture-correlation',$5,$6)`, [id, `sensitive-integration:mcp.${tool}`, outcome, outcome === "denied" ? "ACCESS_DENIED" : null, JSON.stringify(metadata), time]);
		}
		if (mode === "removed") await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
		if (mode === "suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended' WHERE creator_id='creator'");
		if (mode === "revoked-connection") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=now() WHERE id=$1", [grant]);
		const principal = { kind: "session" as const, authUserId: mode === "no-audit" || mode === "analyst" || mode === "free-team" ? "viewer" : "owner", sessionId: "verified-fixture-session", authenticatedAt: now };
		const service = await import("@/server/mcp/activity");
		const list = (service as any).listMcpActivity;
		let result: any = null,
			error: any = null,
			second: any = null;
		try {
			if (list) {
				result = await list(principal, { creatorId: mode === "foreign" ? "foreign" : "creator", limit: mode === "pagination" || mode === "cross-actor-cursor" || mode === "cross-creator-cursor" ? 1 : mode === "invalid-limit" ? 101 : 25, ...(mode === "malformed-cursor" ? { cursor: "private-invalid-cursor" } : {}) }, fixture.db);
				if (result?.nextCursor && (mode === "pagination" || mode === "cross-actor-cursor" || mode === "cross-creator-cursor")) second = await list(mode === "cross-actor-cursor" ? { ...principal, authUserId: "viewer" } : principal, { creatorId: mode === "cross-creator-cursor" ? "foreign" : "creator", limit: 1, cursor: result.nextCursor }, fixture.db);
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "unknown";
		}
		console.log(JSON.stringify({ available: !!list, result, second, error }));
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
