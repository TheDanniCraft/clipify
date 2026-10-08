import type { PoolClient } from "pg";
import { createMcpPostgresFixture } from "./postgres";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const [kind, expiry] = process.argv.slice(2);
	const grantId = "55a14977-cf49-4338-adbd-9d9d50178b83";
	let blocker: PoolClient | undefined;
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,now(),now())`);
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',now())`);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('owner','creator-org','owner','owner',now())`);
		const overlays = await import("@/server/resources/overlays");
		const playlists = await import("@/server/resources/playlists");
		const deadline = new Date(Date.now() + 2000);
		await fixture.pool.query(`INSERT INTO mcp_connection_grants (id,auth_user_id,client_id,resource,issuer,generation,scopes,active,expires_at) VALUES ($1,'owner','client','https://clipify.example/mcp','https://clipify.example/api/auth',1,ARRAY['overlay:create','playlist:create'],true,$2)`, [grantId, expiry === "grant" ? deadline : new Date(Date.now() + 3600000)]);
		await fixture.pool.query(`INSERT INTO mcp_grant_creators (grant_id,creator_id) VALUES ($1,'creator')`, [grantId]);
		const principal: TrustedCreatorPrincipal = { kind: "oauth", authUserId: "owner", authenticatedAt: new Date(), grantId, clientId: "client", generation: 1, resource: "https://clipify.example/mcp", issuer: "https://clipify.example/api/auth", scopes: ["overlay:create", "playlist:create"], creators: [{ creatorId: "creator", agencyOrganizationId: null }], tokenExpiresAt: expiry === "token" ? deadline : new Date(Date.now() + 3600000) };
		blocker = await fixture.pool.connect();
		await blocker.query("BEGIN");
		await blocker.query("LOCK TABLE audit_events IN ACCESS EXCLUSIVE MODE");
		const input = { creatorId: "creator", name: "Created", retryKey: "expiry-creation" };
		const pending = kind === "overlay" ? overlays.createOverlayForPrincipal(principal, input, fixture.db) : playlists.createPlaylistForPrincipal(principal, input, fixture.db);
		const mutation = pending.then(
			() => ({ success: true, error: null }),
			(error: unknown) => ({ success: false, error: error instanceof Error ? error.message : "unknown" }),
		);
		let waited = false;
		const waitDeadline = performance.now() + 1500;
		while (performance.now() < waitDeadline) {
			const waiting = await fixture.pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1", ['%"audit_events"%']);
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
		const resources = Number((await fixture.pool.query(kind === "overlay" ? "SELECT count(*) FROM overlays" : "SELECT count(*) FROM playlists")).rows[0].count);
		const retries = Number((await fixture.pool.query("SELECT count(*) FROM mcp_mutation_retries")).rows[0].count);
		const audits = Number((await fixture.pool.query("SELECT count(*) FROM audit_events")).rows[0].count);
		console.log(JSON.stringify({ ...outcome, waited, resources, retries, audits }));
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
