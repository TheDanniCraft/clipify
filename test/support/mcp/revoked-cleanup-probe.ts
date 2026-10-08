import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const mode = process.argv[2];
	const now = new Date();
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('actor','Actor','actor@example.invalid',true,$1,$1)`, [now]);
		await fixture.pool.query(`INSERT INTO auth.oauth_client (id,client_id,name,redirect_uris,created_at) VALUES ('client','client','Client',ARRAY['https://client.example/callback'],$1)`, [now]);
		const revoked = "55a14977-cf49-4338-adbd-9d9d50178b83",
			active = "55a14977-cf49-4338-adbd-9d9d50178b84";
		for (const [id, isActive] of [
			[revoked, false],
			[active, true],
		] as const)
			await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,revoked_at,expires_at) VALUES ($1,'actor','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['creator:read'],$2,$3,$4)`, [id, isActive, isActive ? null : now, new Date(now.getTime() + 3600000)]);
		for (const table of ["oauth_access_token", "oauth_refresh_token", "oauth_consent"]) {
			for (const [id, reference] of [
				["revoked-1", revoked],
				["revoked-2", revoked],
				["revoked-3", revoked],
				["active", active],
				["unbound", null],
				["unknown", "unknown-grant"],
			]) {
				if (table === "oauth_consent") await fixture.pool.query(`INSERT INTO auth.${table} (id,client_id,user_id,reference_id,scopes,created_at,updated_at) VALUES ($1,'client','actor',$2,ARRAY['creator:read'],$3,$3)`, [id, reference, now]);
				else await fixture.pool.query(`INSERT INTO auth.${table} (id,token,client_id,user_id,reference_id,scopes,created_at,expires_at) VALUES ($1,$1,'client','actor',$2,ARRAY['creator:read'],$3,$4)`, [id, reference, now, new Date(now.getTime() + 3600000)]);
			}
		}
		const service = await import("@/server/mcp/cleanup");
		const prune = (service as any).pruneRevokedMcpCredentials;
		let result: any = null;
		if (prune) result = mode === "concurrent" ? await Promise.all([prune({ batchSize: 1 }, fixture.db), prune({ batchSize: 1 }, fixture.db)]) : await prune({ batchSize: mode === "bounded" ? 1 : 100 }, fixture.db);
		const remaining: any = {};
		for (const table of ["oauth_access_token", "oauth_refresh_token", "oauth_consent"]) remaining[table] = (await fixture.pool.query(`SELECT id FROM auth.${table} ORDER BY id`)).rows.map((r) => r.id);
		const grants = (await fixture.pool.query("SELECT active,revoked_at FROM mcp_connection_grants WHERE id=$1", [revoked])).rows[0];
		console.log(JSON.stringify({ available: !!prune, result, remaining, revoked: !grants.active && !!grants.revoked_at }));
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
