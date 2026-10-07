import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { symmetricEncrypt } from "better-auth/crypto";
import { createMcpPostgresFixture } from "./postgres";

async function main() {
	const fixture = await createMcpPostgresFixture();
	const mode = process.argv[2];
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";

	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = "isolated-reward-ownership-secret-32chars";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-reward-ownership-rate-secret-32chars";
	process.env.TWITCH_CLIENT_ID = "isolated-reward-ownership-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-reward-ownership-client-secret";
	const overlayId = randomUUID(),
		accountId = randomUUID(),
		providerToken = "private-reward-owner-provider-token";
	const calls: boolean[] = [];
	let lockFree = false;
	const sockets = new Set<import("node:net").Socket>();
	const server = createServer(async (request, response) => {
		const url = new URL(request.url!, "http://127.0.0.1");
		calls.push(request.method === "GET" && url.pathname === "/helix/channel_points/custom_rewards" && url.searchParams.get("broadcaster_id") === "reward-creator" && url.searchParams.get("id") === "RewardOne" && request.headers.authorization === `Bearer ${providerToken}` && request.headers["client-id"] === process.env.TWITCH_CLIENT_ID);
		const independent = await fixture.pool.connect();
		try {
			await independent.query("BEGIN");
			await independent.query("SELECT id FROM overlays WHERE id=$1 FOR UPDATE NOWAIT", [overlayId]);
			lockFree = true;
		} catch {
			lockFree = false;
		} finally {
			await independent.query("ROLLBACK");
			independent.release();
		}
		if (mode === "plan-change") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='reward-creator'");
		if (mode === "membership-change") await fixture.pool.query("DELETE FROM auth.member WHERE user_id='reward-owner'");
		if (mode === "revision-change") await fixture.pool.query("UPDATE overlays SET configuration_revision=2 WHERE id=$1", [overlayId]);
		if (mode === "headers") return;
		response.setHeader("Content-Type", "application/json");
		if (mode === "body") {
			response.writeHead(200);
			response.write('{"data":[');
			return;
		}
		if (mode === "not-found" || mode === "rate" || mode === "provider-error") {
			response.statusCode = mode === "not-found" ? 404 : mode === "rate" ? 429 : 503;
			response.end("{}");
			return;
		}
		if (mode === "malformed") {
			response.end("not-json");
			return;
		}
		if (mode === "wrong-content-type") response.setHeader("Content-Type", "text/plain");
		response.end(JSON.stringify({ data: mode === "empty" ? [] : [{ id: mode === "wrong-reward" ? "OtherReward" : "RewardOne", broadcaster_id: mode === "foreign-reward" ? "other-creator" : "reward-creator" }], ...(mode === "oversized" ? { padding: "x".repeat(65536) } : {}) }));
	});
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	const originalFetch = globalThis.fetch;
	let blocker: import("pg").PoolClient | undefined;
	try {
		await fixture.pool.query(
			"INSERT INTO auth.\"user\"(id,name,email,email_verified,created_at,updated_at) VALUES('reward-owner','Reward owner','reward-owner@example.invalid',true,now(),now()),('reward-foreign','Foreign','reward-foreign@example.invalid',true,now(),now()); INSERT INTO auth.organization(id,name,slug,created_at) VALUES('reward-org','Reward creator','reward-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('reward-creator','reward-creator@example.invalid','Reward creator','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('reward-creator','reward-org','active'); INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('reward-member','reward-org','reward-owner','owner',now())",
		);
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'reward-creator','private-reward-overlay-secret','Reward overlay','active','Featured')", [overlayId]);
		if (mode !== "missing-credentials") {
			await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('reward-creator','reward-owner','twitch_onboarding')");
			const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET, data: providerToken });
			await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,'reward-creator','twitch','reward-owner',$2,now()+interval '1 hour','channel:read:redemptions',now(),now())", [accountId, encrypted]);
		}
		const { auth } = await import("@/auth/config");
		const context = await auth.$context;
		const session = await context.internalAdapter.createSession(mode === "foreign-session" ? "reward-foreign" : "reward-owner", false, { activeOrganizationId: "reward-org" }, true);
		if (!session || typeof context.secret !== "string") throw new Error("REWARD_OWNERSHIP_SESSION_UNAVAILABLE");
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const headers = new Headers({ cookie: context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed) });
		if (mode === "unauthenticated") headers.delete("cookie");
		if (mode === "free" || mode === "unchanged-free") await fixture.pool.query("UPDATE users SET plan='free'");
		if (mode === "removed-member") await fixture.pool.query("DELETE FROM auth.member");
		if (mode === "unchanged" || mode === "unchanged-free" || mode === "clear") await fixture.pool.query("UPDATE overlays SET reward_id='RewardOne'");
		if (mode === "rollback") await fixture.pool.query("CREATE FUNCTION reject_reward_ownership_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled reward audit failure'; END $$; CREATE TRIGGER reject_reward_ownership_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_reward_ownership_audit()");
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("REWARD_OWNERSHIP_HTTP_UNAVAILABLE");
		globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
			const request = value instanceof Request ? value : new Request(value, init);
			const url = new URL(request.url);
			if (url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/channel_points/custom_rewards") throw new Error("REWARD_OWNERSHIP_EXTERNAL_IO_FORBIDDEN");
			return originalFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, { method: request.method, headers: request.headers, signal: request.signal });
		}) as typeof fetch;
		if (mode === "credentials") {
			blocker = await fixture.pool.connect();
			await blocker.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [`clipify:twitch:${accountId}`]);
		}
		const { saveBrowserOverlay } = await import("@/server/resources/browser-overlays");
		const started = performance.now();
		const saved = await saveBrowserOverlay(overlayId, { rewardId: mode === "clear" ? null : "RewardOne", ...(mode.startsWith("unchanged") ? { name: "Reward renamed" } : {}) }, mode === "stale" ? 2 : 1, headers);
		const elapsedMs = performance.now() - started;
		if (blocker) {
			await blocker.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`clipify:twitch:${accountId}`]);
			blocker.release();
			blocker = undefined;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const stored = (await fixture.pool.query("SELECT reward_id,configuration_revision FROM overlays WHERE id=$1", [overlayId])).rows[0];
		const counts = (await fixture.pool.query("SELECT (SELECT count(*) FROM overlay_effect_jobs)::int AS jobs,(SELECT count(*) FROM audit_events)::int AS audits")).rows[0];
		console.log(JSON.stringify({ saved: !!saved, rewardId: stored.reward_id, revision: stored.configuration_revision, ...counts, calls: calls.length, requestValid: calls.every(Boolean), lockFree, elapsedMs }));
	} finally {
		globalThis.fetch = originalFetch;
		if (blocker) {
			await blocker.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`clipify:twitch:${accountId}`]);
			blocker.release();
		}
		for (const socket of sockets) socket.destroy();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
