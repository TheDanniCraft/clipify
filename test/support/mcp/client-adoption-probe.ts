import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	try {
		const { getMcpClientStats, getMcpClientHealthStats } = await import("@/server/mcp/client-stats");
		await fixture.pool.query(`INSERT INTO auth."user"(id,name,email,email_verified,created_at,updated_at) VALUES('adoption-owner','Owner','adoption@example.invalid',true,now(),now());
   INSERT INTO auth.oauth_client(id,client_id,name,redirect_uris) VALUES('a','chat-old','ChatGPT','{}'),('b','chat-new','ChatGPT','{}'),('c','custom','Meta MCP','{}'),('d','unused','Unused','{}');
   INSERT INTO mcp_connection_grants(auth_user_id,client_id,resource,issuer,scopes,active,expires_at) VALUES('adoption-owner','chat-old','https://clipify.example/mcp','https://clipify.example/api/auth','{}',true,now()+interval '1 day'),('adoption-owner','chat-new','https://clipify.example/mcp','https://clipify.example/api/auth','{}',true,NULL);`);
		for (const clientId of ["chat-old", "chat-new", "custom", "deleted-client"]) await fixture.pool.query(`INSERT INTO audit_events(actor_user_id,target_type,action,outcome,correlation_id,occurred_at,metadata) VALUES('adoption-owner','mcp_connection','sensitive-integration:mcp.list_creators','success',gen_random_uuid(),now(),$1::jsonb)`, [JSON.stringify({ clientId })]);
		const grant = (await fixture.pool.query("SELECT id FROM mcp_connection_grants WHERE client_id='chat-old'")).rows[0].id;
		await fixture.pool.query("UPDATE audit_events SET metadata=metadata||$1::jsonb WHERE metadata->>'clientId'='chat-old'", [JSON.stringify({ grantId: grant, resultState: "queued" })]);
		const first = await getMcpClientStats(1, 1, fixture.db),
			second = await getMcpClientStats(2, 1, fixture.db);
		let invalidRejected = false;
		try {
			await getMcpClientStats(-1, 1, fixture.db);
		} catch {
			invalidRejected = true;
		}
		await fixture.pool.query(`INSERT INTO auth.oauth_client(id,client_id,name,redirect_uris) SELECT 'bulk-'||n,'bulk-'||n,'Custom '||n,'{}' FROM generate_series(1,25) n`);
		const all = await getMcpClientHealthStats(fixture.db);
		console.log(JSON.stringify({ entry: all.entry, allCount: all.items.length, allSummary: all.summary.applicationNames, summary: first.summary, first, second, invalidRejected, redacted: !JSON.stringify(first).includes("chat-old") && !JSON.stringify(first).includes("adoption-owner") }));
	} finally {
		await fixture.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
