import { Client } from "pg";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.ENTITLEMENTS_HYBRID_ENABLED = "false";
	const original = Client.prototype.query;
	let reads = 0;
	try {
		await fixture.pool.query(`INSERT INTO auth.user(id,name,email) VALUES('consent-actor','Actor','actor@example.invalid');
		INSERT INTO auth.organization(id,name,slug,created_at) VALUES('consent-org','Consent','consent-org',now());
		INSERT INTO users(id,email,username,avatar,role,plan,created_at) VALUES('consent-creator','creator@example.invalid','Creator','','user','pro','2020-01-01');
		INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('consent-creator','consent-org','active');
		INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('consent-member','consent-org','consent-actor','operations',now());
		INSERT INTO auth.organization(id,name,slug,created_at) VALUES('consent-agency','Agency','consent-agency',now()),('foreign-org','Foreign','foreign-org',now());
		INSERT INTO users(id,email,username,avatar,role,plan,created_at) VALUES('foreign-creator','foreign@example.invalid','Foreign','','user','free','2020-01-01');
		INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('foreign-creator','foreign-org','active');
		INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('agency-member','consent-agency','consent-actor','operations',now());
		INSERT INTO agency_creator_links(agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES('consent-agency','foreign-org','accepted','["creator:read","overlay:read"]','consent-actor',now());
		INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('reader-role','consent-org','reader','{"creator":["read"],"overlay":["read"]}');`);
		Client.prototype.query = new Proxy(original, {
			apply(target, receiver, args) {
				const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
				if (typeof text === "string" && /from "creator_accounts".*"creator_id"/.test(text)) reads++;
				return Reflect.apply(target, receiver, args);
			},
		});
		const { approveMcpConsent } = await import("@/server/mcp/grants");
		const origin = "http://127.0.0.1:3107";
		const scopes = ["creator:read", "overlay:read", "overlay:update", "playlist:read"];
		const outcomes = [];
		for (const mode of ["allowed", "mixed-denied", "removed-member", "expired-pro", "suspended", "restored", "agency-mixed-denied"]) {
			await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('consent-member','consent-org','consent-actor','operations',now()) ON CONFLICT(id) DO UPDATE SET role='operations'; UPDATE users SET plan='pro'; UPDATE creator_accounts SET status='active'");
			if (mode === "mixed-denied") await fixture.pool.query("UPDATE auth.member SET role='reader'");
			if (mode === "removed-member") await fixture.pool.query("DELETE FROM auth.member");
			if (mode === "expired-pro") await fixture.pool.query("UPDATE users SET plan='free'");
			if (mode === "suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
			const before = (await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants")).rows[0].count;
			reads = 0;
			const response = await approveMcpConsent({
				auth: {
					api: { getSession: async () => ({ user: { id: "consent-actor" }, session: { id: "session", createdAt: new Date(), activeOrganizationId: "consent-org" } }) },
					handler: async () => Response.json({ url: "https://client.example/callback?code=fixture" }),
				},
				origin,
				headers: new Headers({ origin }),
				oauthQuery: new URLSearchParams({ client_id: "fixture-client", scope: scopes.join(" "), sig: "provider-fixture" }).toString(),
				accept: true,
				scopes,
				creators: [{ creatorId: mode === "agency-mixed-denied" ? "foreign-creator" : "consent-creator", agencyOrganizationId: mode === "agency-mixed-denied" ? "consent-agency" : null, scopes }],
			});
			const count = reads;
			const after = (await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants")).rows[0].count;
			outcomes.push({ mode, status: response.status, reads: count, grantsAdded: after - before });
		}
		console.log(JSON.stringify(outcomes));
	} finally {
		Client.prototype.query = original;
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
