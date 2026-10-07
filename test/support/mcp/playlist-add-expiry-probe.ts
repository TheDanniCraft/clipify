import { createServer } from "node:http";
import { symmetricEncrypt } from "better-auth/crypto";
import type { PoolClient } from "pg";
import { createMcpPostgresFixture } from "./postgres";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const [expiry] = process.argv.slice(2);
	const secret = "isolated-item-expiry-auth-secret-32chars";
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.BETTER_AUTH_SECRET = secret;
	process.env.TWITCH_CLIENT_ID = "isolated-item-expiry-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-item-expiry-secret";
	const originalFetch = globalThis.fetch;
	let providerCalls = 0;
	let credentialUsed = false;
	const server = createServer((request, response) => {
		providerCalls++;
		credentialUsed = request.headers.authorization === "Bearer isolated-item-access" && request.headers["client-id"] === "isolated-item-expiry-client";
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ data: [{ id: "NewClip", title: "New", duration: 10, broadcaster_id: "creator", created_at: "2025-01-01T00:00:00Z" }] }));
	});
	const grantId = "55a14977-cf49-4338-adbd-9d9d50178b83";
	let blocker: PoolClient | undefined;
	try {
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("No isolated clip endpoint");
		globalThis.fetch = (input, options) => {
			const value = input instanceof Request ? input.url : String(input);
			const url = new URL(value);
			return originalFetch(url.origin === "https://api.twitch.tv" ? `http://127.0.0.1:${address.port}${url.pathname}${url.search}` : input, options);
		};
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,now(),now())`);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',now())`);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('owner','creator-org','owner','owner',now())`);
		await fixture.pool.query(`INSERT INTO overlays (id,owner_id,name,secret,status,type) VALUES ('11111111-1111-4111-8111-111111111111','creator','Before','fixture-secret','active','Featured')`);
		await fixture.pool.query(`INSERT INTO playlists (id,owner_id,name) VALUES ('22222222-2222-4222-8222-222222222222','creator','Before')`);
		await fixture.pool.query("INSERT INTO creator_identity_links (creator_id,auth_user_id,source) VALUES ('creator','owner','twitch_onboarding')");
		await fixture.pool.query("INSERT INTO auth.account (id,account_id,provider_id,user_id,access_token,refresh_token,access_token_expires_at,updated_at) VALUES ('provider-account','twitch-owner','twitch','owner',$1,$2,now()+interval '1 hour',now())", [await symmetricEncrypt({ key: secret, data: "isolated-item-access" }), await symmetricEncrypt({ key: secret, data: "isolated-item-refresh" })]);
		await fixture.pool.query(`INSERT INTO playlist_clips (playlist_id,clip_id,position,clip_data) VALUES ('22222222-2222-4222-8222-222222222222','clip-a',0,'{"id":"clip-a","title":"A","duration":10}'),('22222222-2222-4222-8222-222222222222','clip-b',1,'{"id":"clip-b","title":"B","duration":10}')`);
		const playlists = await import("@/server/resources/playlists");
		const deadline = new Date(Date.now() + 2000);
		await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'owner','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['playlist-items:manage'],true,$2)`, [grantId, expiry === "grant" ? deadline : new Date(Date.now() + 3600000)]);
		await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [grantId]);
		const principal: TrustedCreatorPrincipal = { kind: "oauth", authUserId: "owner", authenticatedAt: new Date(), grantId, clientId: "client", generation: 1, resource: "https://clipify.example/mcp", issuer: "https://clipify.example/api/auth", scopes: ["playlist-items:manage"], creators: [{ creatorId: "creator", agencyOrganizationId: null }], tokenExpiresAt: expiry === "token" ? deadline : new Date(Date.now() + 3600000) };
		blocker = await fixture.pool.connect();
		await blocker.query("BEGIN");
		await blocker.query("SELECT id FROM playlists WHERE id='22222222-2222-4222-8222-222222222222' FOR UPDATE");
		const input = { creatorId: "creator", playlistId: "22222222-2222-4222-8222-222222222222", expectedRevision: 1 };
		const pending = playlists.addPlaylistItems(principal, { ...input, clipIds: ["NewClip"] }, fixture.db);
		const mutation = pending.then(
			() => ({ success: true, error: null }),
			(error: unknown) => ({ success: false, error: error instanceof Error ? error.message : "unknown" }),
		);
		let waited = false;
		const waitDeadline = performance.now() + 1500;
		while (performance.now() < waitDeadline) {
			const waiting = await fixture.pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1", ['%"playlists"%']);
			if (Number(waiting.rows[0].count)) {
				waited = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		if (expiry !== "active") await new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline.getTime() - Date.now() + 20)));
		await blocker.query("COMMIT");
		blocker.release();
		blocker = undefined;
		const outcome = await mutation;
		const current = await fixture.pool.query("SELECT name,configuration_revision FROM playlists WHERE id='22222222-2222-4222-8222-222222222222'");
		const items = (await fixture.pool.query("SELECT clip_id,position FROM playlist_clips ORDER BY position")).rows;
		const audits = await fixture.pool.query("SELECT count(*) FROM audit_events");
		console.log(JSON.stringify({ ...outcome, waited, current: current.rows[0] ?? null, items, providerCalls, credentialUsed, audits: Number(audits.rows[0].count) }));
	} finally {
		globalThis.fetch = originalFetch;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		if (blocker) {
			await blocker.query("ROLLBACK");
			blocker.release();
		}
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
