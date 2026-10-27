import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.USESEND_API_KEY = "";
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.TWITCH_CLIENT_ID = "isolated-export-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-export-client-secret";
	process.env.BETTER_AUTH_SECRET = "account-export-fixture-secret-at-least-32-characters";
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
			await fixture.pool.query("INSERT INTO subject (id,\"externalId\") VALUES ('export-subject','owner')");
		}
		if (mode === "expired") await fixture.pool.query("UPDATE mcp_connection_grants SET expires_at=$1 WHERE id=$2", [now, ownId]);
		if (mode === "unnamed") await fixture.pool.query("UPDATE auth.oauth_client SET name=NULL WHERE client_id='client'");
		if (mode === "empty") await fixture.pool.query("DELETE FROM mcp_connection_grants WHERE auth_user_id='owner'");
		if (mode === "complete") {
			const { symmetricEncrypt } = await import("better-auth/crypto");
			const { auth } = await import("@/auth/config");
			const encryptedAccess = await symmetricEncrypt({ key: (await auth.$context).secretConfig, data: "owner-access-token" });
			await fixture.pool.query("UPDATE users SET username='password is an ordinary username',created_at=$1,last_login=$1 WHERE id='creator'", [now]);
			await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('other-creator','other@example.invalid','Other','','user','free')");
			await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,refresh_token,created_at,updated_at) VALUES('owner-account','creator','twitch','owner',$2,'owner-refresh-token',$1,$1),('foreign-account','other-creator','twitch','foreign','foreign-access-token','foreign-refresh-token',$1,$1)", [now, encryptedAccess]);
			await fixture.pool.query("INSERT INTO auth.session(id,token,user_id,created_at,updated_at,expires_at) VALUES('owner-session','owner-session-token','owner',$1,$1,$2),('foreign-session','foreign-session-token','foreign',$1,$1,$2)", [now, new Date(now.getTime() + 3600000)]);
			await fixture.pool.query(`INSERT INTO "twitchCache"(type,key,value) VALUES('clip','clip:creator:own-clip',$1),('clip','clip:other-creator:foreign-clip',$2)`, [JSON.stringify({ clip: { id: "own-clip", title: "my stored clip", broadcaster_id: "creator" } }), JSON.stringify({ clip: { id: "foreign-clip", title: "foreign-private-clip" } })]);
			await fixture.pool.query("INSERT INTO runner_destinations(owner_id,name,provider,rtmp_url,encrypted_stream_key) VALUES('creator','Owned destination','custom','rtmp://stream.example/live',NULL),('other-creator','Foreign destination','custom','rtmp://foreign.example/live',NULL)");
			await fixture.pool.query("INSERT INTO auth.oauth_client(id,client_id,name,client_secret,user_id,redirect_uris,created_at) VALUES('owned-client','owned-client','My app','owned-client-secret','owner',ARRAY['https://myapp.example/callback'],$1)", [now]);
			await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,created_at,updated_at) VALUES('legacy-account','legacy','google','owner','$ba$unavailable',$1,$1)", [now]);
			await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('owner-member','creator-org','owner','owner',$1)", [now]);
			await fixture.pool.query(`INSERT INTO auth.invitation(id,organization_id,email,inviter_id,expires_at) VALUES('own-invitation','creator-org','owner@example.invalid','owner',$1)`, [now]);
			await fixture.pool.query(`INSERT INTO audit_events(actor_user_id,account_organization_id,target_type,target_id,action,outcome,correlation_id) VALUES('owner','creator-org','creator','creator','export.fixture','success','export-fixture')`);
			await fixture.pool.query(`INSERT INTO notification_outbox(event_type,recipient,authority_organization_id,template_version,scheduled_at,dedupe_key) VALUES('export.fixture','owner@example.invalid','creator-org','v1',$1,'export-fixture')`, [now]);
			await fixture.pool.query(`INSERT INTO overlays(owner_id,name,status,type) VALUES('creator','Own overlay','active','All')`);
			await fixture.pool.query(`INSERT INTO "clipQueue"(overlay_id,clip_id) SELECT id,'own-clip' FROM overlays WHERE owner_id='creator'`);
			await fixture.pool.query(`INSERT INTO playlists(owner_id,name) VALUES('creator','Own playlist')`);
			await fixture.pool.query(`INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) SELECT id,'own-clip',0,'{"id":"own-clip"}' FROM playlists WHERE owner_id='creator'`);
			await fixture.pool.query(`INSERT INTO "userSettings"(id) VALUES('creator')`);
			await fixture.pool.query(`INSERT INTO subject(id,"externalId") VALUES('own-subject','owner')`);
			await fixture.pool.query(`INSERT INTO domain(id,name) VALUES('own-domain','clipify.example')`);
			await fixture.pool.query(`INSERT INTO "consentPolicy"(id,version,type,"effectiveDate","isActive") VALUES('own-policy','v1','privacy',$1,true)`, [now]);
			await fixture.pool.query(`INSERT INTO "consentPurpose"(id,code) VALUES('own-purpose','analytics')`);
			await fixture.pool.query(`INSERT INTO "runtimePolicyDecision"(id,"policyId",fingerprint,"matchedBy",model,"dedupeKey") VALUES('own-decision','own-policy','fixture','country','opt-in','export-decision')`);
			await fixture.pool.query(`INSERT INTO consent(id,"subjectId","domainId","policyId","purposeIds","runtimePolicyDecisionId") VALUES('own-consent','own-subject','own-domain','own-policy','["own-purpose",null]','own-decision'),('legacy-consent','own-subject','own-domain',NULL,'null',NULL)`);
			await fixture.pool.query(`INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES('55a14977-cf49-4338-adbd-9d9d50178b85','creator','logo','image/png',4,1,1,'fixture',$1)`, [Buffer.from([137, 80, 78, 71])]);
		}

		const { collectComprehensiveAccountData } = await import("@/server/account-lifecycle/account-data-export");
		if (mode === "sparse") {
			await fixture.pool.query("DELETE FROM users WHERE id='creator'");
			await fixture.pool.query("DELETE FROM auth.\"user\" WHERE id='owner'");
		}
		const exported = await collectComprehensiveAccountData({ authUserId: "owner", creatorId: "creator", organizationId: "creator-org", ...(mode === "sparse" ? {} : { now }) });
		if (mode === "sparse") {
			console.log(JSON.stringify(exported));
			return;
		}
		if (mode === "complete") {
			const { createAccountDataArchive } = await import("@/server/account-lifecycle/account-data-archive");
			const { unzipSync, strFromU8 } = await import("fflate");
			const files = unzipSync(await createAccountDataArchive(exported as Record<string, unknown>));
			const manifest = JSON.parse(strFromU8(files["manifest.json"]));
			const profile = JSON.parse(strFromU8(files["identity/profile.json"]));
			const cache = JSON.parse(strFromU8(files["clipStorage/cache.json"]));
			const credentials = JSON.parse(strFromU8(files["identity/providerAccounts.json"]));
			const decoded = JSON.parse(strFromU8(files["reusableCredentials/oauthAccounts.json"]));
			const serialized = JSON.stringify(exported);
			console.log(
				JSON.stringify({
					files: Object.keys(files),
					tableCount: manifest.tables.length,
					unclassified: manifest.tables.filter((entry: { status: string }) => !["included", "system_or_shared"].includes(entry.status)).length,
					username: profile.username,
					createdAt: profile.createdAt,
					clipIds: cache.map((entry: { key: string }) => entry.key),
					ownCredentialsPresent: Boolean(credentials.find((row: { id: string; accessToken: string }) => row.id === "owner-account")?.accessToken) && decoded.find((row: { accountId: string }) => row.accountId === "owner-account")?.accessToken?.value === "owner-access-token" && serialized.includes("owner-session-token"),
					unavailableCredentialPreserved: decoded.find((row: { accountId: string }) => row.accountId === "legacy-account")?.accessToken?.storedValue === "$ba$unavailable",
					brandingBytes: [...files["assets/55a14977-cf49-4338-adbd-9d9d50178b85.png"]],
					consentPolicyIds: JSON.parse(strFromU8(files["privacy/policies.json"])).map((row: { id: string }) => row.id),
					foreignDataPresent: ["foreign-access-token", "foreign-session-token", "foreign-private-clip", "Foreign destination", "private-client-secret"].some((value) => serialized.includes(value)),
					registeredClients: JSON.parse(strFromU8(files["aiApps/registeredClients.json"])).map((entry: { clientId: string }) => entry.clientId),
					notice: strFromU8(files["READ-ME-FIRST.txt"]),
					externalSupportStatus: manifest.externalSources.support.status,
				}),
			);
			return;
		}

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
