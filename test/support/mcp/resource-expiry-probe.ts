import type { PoolClient } from "pg";
import { createMcpPostgresFixture } from "./postgres";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const [kind, expiry, operation = "update"] = process.argv.slice(2);
	const grantId = "55a14977-cf49-4338-adbd-9d9d50178b83";
	let blocker: PoolClient | undefined;
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,now(),now())`);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',now())`);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('owner','creator-org','owner','owner',now())`);
		await fixture.pool.query(`INSERT INTO overlays (id,owner_id,name,secret,status,type) VALUES ('11111111-1111-4111-8111-111111111111','creator','Before','fixture-secret','active','Featured')`);
		await fixture.pool.query(`INSERT INTO playlists (id,owner_id,name) VALUES ('22222222-2222-4222-8222-222222222222','creator','Before')`);
		const overlays = await import("@/server/resources/overlays");
		const playlists = await import("@/server/resources/playlists");
		const deadline = new Date(Date.now() + 2000);
		await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'owner','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['overlay:update','playlist:update','overlay:delete','playlist:delete'],true,$2)`, [grantId, expiry === "grant" ? deadline : new Date(Date.now() + 3600000)]);
		await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [grantId]);
		const principal: TrustedCreatorPrincipal = { kind: "oauth", authUserId: "owner", authenticatedAt: new Date(), grantId, clientId: "client", generation: 1, resource: "https://clipify.example/mcp", issuer: "https://clipify.example/api/auth", scopes: ["overlay:update", "playlist:update", "overlay:delete", "playlist:delete"], creators: [{ creatorId: "creator", agencyOrganizationId: null }], tokenExpiresAt: expiry === "token" ? deadline : new Date(Date.now() + 3600000) };
		blocker = await fixture.pool.connect();
		await blocker.query("BEGIN");
		await blocker.query(kind === "overlay" ? "SELECT id FROM overlays WHERE id='11111111-1111-4111-8111-111111111111' FOR UPDATE" : "SELECT id FROM playlists WHERE id='22222222-2222-4222-8222-222222222222' FOR UPDATE");
		const pending =
			operation === "delete"
				? kind === "overlay"
					? overlays.deleteOverlay(principal, { creatorId: "creator", overlayId: "11111111-1111-4111-8111-111111111111", expectedRevision: 1 }, fixture.db)
					: playlists.deletePlaylist(principal, { creatorId: "creator", playlistId: "22222222-2222-4222-8222-222222222222", expectedRevision: 1 }, fixture.db)
				: kind === "overlay"
					? overlays.updateOverlay(principal, { creatorId: "creator", overlayId: "11111111-1111-4111-8111-111111111111", expectedRevision: 1, patch: { name: "After" } }, fixture.db)
					: playlists.updatePlaylist(principal, { creatorId: "creator", playlistId: "22222222-2222-4222-8222-222222222222", expectedRevision: 1, name: "After" }, fixture.db);
		const mutation = pending.then(
			() => ({ success: true, error: null }),
			(error: unknown) => ({ success: false, error: error instanceof Error ? error.message : "unknown" }),
		);
		let waited = false;
		const waitDeadline = performance.now() + 1500;
		while (performance.now() < waitDeadline) {
			const waiting = await fixture.pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1", [`%\"${kind === "overlay" ? "overlays" : "playlists"}\"%`]);
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
		const current = await fixture.pool.query(kind === "overlay" ? "SELECT name,configuration_revision FROM overlays WHERE id='11111111-1111-4111-8111-111111111111'" : "SELECT name,configuration_revision FROM playlists WHERE id='22222222-2222-4222-8222-222222222222'");
		const audits = await fixture.pool.query("SELECT count(*) FROM audit_events");
		console.log(JSON.stringify({ ...outcome, waited, current: current.rows[0] ?? null, audits: Number(audits.rows[0].count) }));
	} finally {
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
