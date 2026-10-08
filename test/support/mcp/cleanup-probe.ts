import { existsSync } from "node:fs";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const now = new Date("2026-10-05T00:00:00Z");
	const mode = process.argv[2];
	try {
		await fixture.pool.query("INSERT INTO auth.\"user\" (id,name,email,email_verified,created_at,updated_at) VALUES ('actor','Cleanup actor','cleanup@example.invalid',true,$1,$1)", [now]);
		await fixture.pool.query("INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('org','Cleanup creator','cleanup-creator',$1)", [now]);
		await fixture.pool.query("INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','cleanup-creator@example.invalid','Cleanup creator','','user','free')");
		await fixture.pool.query("INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','org','active')");
		const clients = ["expired", "exact", "recent", "consented", "granted", "owned", "cimd", "tokenized", "trusted"];
		for (const name of clients) await fixture.pool.query("INSERT INTO auth.oauth_client (id,client_id,name,redirect_uris,created_at,user_id,client_discovery_id) VALUES ($1,$1,$1,ARRAY['https://client.example/callback'],$2,$3,$4)", [name, new Date(now.getTime() - (name === "recent" ? 86399999 : name === "exact" ? 86400000 : 90000000)), name === "owned" ? "actor" : null, name === "cimd" ? "https://client.example/metadata.json" : null]);
		await fixture.pool.query("UPDATE auth.oauth_client SET skip_consent=true WHERE client_id='trusted'");
		await fixture.pool.query("INSERT INTO auth.oauth_consent (id,client_id,user_id,scopes,created_at,updated_at) VALUES ('consent','consented','actor',ARRAY['creator:read'],$1,$1)", [now]);
		await fixture.pool.query("INSERT INTO auth.oauth_access_token (id,token,client_id,user_id,scopes,created_at,expires_at) VALUES ('tokenized','private-fixture-token','tokenized','actor',ARRAY['creator:read'],$1,$2)", [now, new Date(now.getTime() + 60000)]);
		const grantId = "55a14977-cf49-4338-adbd-9d9d50178b83";
		await fixture.pool.query("INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'actor','granted','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['creator:read'],true,$2)", [grantId, new Date(now.getTime() + 3600000)]);
		for (const [name, expiry] of [
			["expired", -1],
			["exact", 0],
			["recent", 1],
		] as const)
			await fixture.pool.query("INSERT INTO mcp_mutation_retries (grant_id,grant_generation,auth_user_id,client_id,creator_id,tool_name,retry_key,input_digest,safe_response,resource_id,created_at,expires_at) VALUES ($1,1,'actor','granted','creator','create_overlay',$2,$3,'{}','87d6572c-f12c-4c1c-85c7-ad72d9cc0ec9',$4,$5)", [grantId, name, "a".repeat(64), new Date(now.getTime() - 90000000), new Date(now.getTime() + expiry)]);
		for (const [index, action, expiry] of [
			[0, "mcp:call:network", -1],
			[1, "mcp:registration:day", 0],
			[2, "mcp:call:network", 1],
			[3, "auth:login", -1],
		] as const)
			await fixture.pool.query("INSERT INTO rate_limit_counters (action,signal_type,signal_hash,count,window_started_at,expires_at) VALUES ($1,'network',$2,1,$3,$4)", [action, String(index).repeat(64), new Date(now.getTime() - 60000), new Date(now.getTime() + expiry)]);
		const service = existsSync("src/server/mcp/cleanup.ts") ? await import("@/server/mcp/cleanup") : null;
		let result: unknown = null;
		if (service) {
			if (mode === "concurrent") result = await Promise.all([service.pruneMcpOperationalRecords({ now, batchSize: 1 }, fixture.db), service.pruneMcpOperationalRecords({ now, batchSize: 1 }, fixture.db)]);
			else result = await service.pruneMcpOperationalRecords({ now, batchSize: mode === "bounded" ? 1 : 100 }, fixture.db);
		}
		const remaining = {
			clients: (await fixture.pool.query("SELECT client_id FROM auth.oauth_client ORDER BY client_id")).rows.map((r) => r.client_id),
			retries: (await fixture.pool.query("SELECT retry_key FROM mcp_mutation_retries ORDER BY retry_key")).rows.map((r) => r.retry_key),
			counters: (await fixture.pool.query("SELECT action,expires_at FROM rate_limit_counters ORDER BY action,expires_at")).rows.map((r) => ({ action: r.action, expired: new Date(r.expires_at) <= now })),
		};
		console.log(JSON.stringify({ available: !!service, result, remaining }));
	} finally {
		if (existsSync("src/server/mcp/cleanup.ts")) {
			const { dbPool } = await import("@/db/client");
			await dbPool.end();
		}
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
