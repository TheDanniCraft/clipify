import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { genericOAuth, oAuthProxy } from "better-auth/plugins";
import { eventGoogleProviders } from "@/auth/google-connections";
import { encryptString } from "@/app/lib/encryption";
import { createMcpPostgresFixture } from "./postgres";
import { googleDiscovery } from "./google-discovery.mjs";

async function main() {
	const fixture = await createMcpPostgresFixture();
	const origin = "https://beta-560.clipify.cloud.thedannicraft.de";
	Object.assign(process.env, {
		DATABASE_URL: fixture.url,
		APP_ENV: "test",
		NEXT_PUBLIC_BASE_URL: origin,
		BETTER_AUTH_SECRET: "isolated-event-auth-secret-32-characters",
		OAUTH_PROXY_SECRET: "isolated-event-proxy-secret-32-characters",
		TWITCH_CLIENT_ID: "fixture-client",
		TWITCH_CLIENT_SECRET: "fixture-secret",
		YOUTUBE_CLIENT_ID: "fixture-google-client",
		YOUTUBE_CLIENT_SECRET: "fixture-google-secret",
		ENCRYPTION_SECRET: "isolated-event-encryption-secret-32-characters",
		DISABLE_BACKGROUND_JOBS: "true",
	});
	delete process.env.COOLIFY_URL;
	const previousFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url === "https://accounts.google.com/.well-known/openid-configuration") return Response.json(googleDiscovery);
		if (url === "https://www.googleapis.com/drive/v3/files?fields=id") return Response.json({ id: "event-folder" });
		if (url === "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true") return Response.json({ items: [{ id: "UCfixture", snippet: { title: "Fixture" } }] });
		throw new Error(`Unexpected provider request: ${url}`);
	}) as typeof fetch;
	const { auth } = await import("@/auth/config");
	const { dbPool } = await import("@/db/client");
	try {
		await fixture.pool.query("INSERT INTO auth.\"user\"(id,name,email,email_verified) VALUES('actor','Fixture','actor@example.invalid',true)");
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('creator','actor@example.invalid','Fixture','','user','pro')");
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('creator-org','Fixture','fixture',now())");
		await fixture.pool.query("INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('creator','creator-org','active')");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('member','creator-org','actor','owner',now())");
		const ctx = await auth.$context;
		const remote = betterAuth({ ...auth.options, baseURL: "https://clipify.us", plugins: [genericOAuth({ config: eventGoogleProviders() }), oAuthProxy({ currentURL: "https://clipify.us", productionURL: "https://clipify.us", secret: process.env.OAUTH_PROXY_SECRET })] });
		const session = await ctx.internalAdapter.createSession("actor", false, { activeOrganizationId: "creator-org" }, true);
		assert(session);
		const signed = session.token + "." + createHmac("sha256", ctx.secret).update(session.token).digest("base64");
		const sessionCookie = ctx.authCookies.sessionToken.name + "=" + encodeURIComponent(signed);
		const scopes = { google: "https://www.googleapis.com/auth/youtube.force-ssl", "google-drive": "https://www.googleapis.com/auth/drive.file", "google-events-youtube": "https://www.googleapis.com/auth/youtube.readonly" };
		const providers = Object.keys(scopes) as (keyof typeof scopes)[];
		for (const instance of [auth, remote]) {
			const context = await instance.$context;
			for (const id of providers) {
				const provider = context.socialProviders.find((item) => typeof item !== "function" && item.id === id);
				if (!provider) continue;
				assert(typeof provider !== "function");
				provider.validateAuthorizationCode = async () => ({ accessToken: `${id}-access`, refreshToken: `${id}-refresh`, accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes: ["openid", "email", "profile", scopes[id]] });
				provider.getUserInfo = async () => ({ user: { name: "Same Google identity", email: "actor@example.invalid", emailVerified: true }, data: { sub: "same-google-subject", email: "actor@example.invalid", email_verified: true } });
			}
		}
		const principal = { kind: "session" as const, authUserId: "actor", sessionId: session.id, authenticatedAt: session.createdAt, organizationId: "creator-org" };
		const { beginEventGoogleConnection, completeEventGoogleConnection, eventGoogleToken } = await import("@/server/events/connections");
		async function link(id: keyof typeof scopes, deny = false) {
			const eventProvider = id === "google-drive" ? "drive" : "youtube";
			const event = id !== "google" ? await beginEventGoogleConnection(principal, "creator", eventProvider, "/dashboard/events", fixture.db) : null;
			assert(!event || event.ok);
			const body = event?.ok ? event.link : { provider: "google", scopes: [scopes.google], callbackURL: `${origin}/dashboard`, disableRedirect: true, additionalParams: { include_granted_scopes: "false" } };
			const start = await auth.handler(new Request(`${origin}/api/auth/link-social`, { method: "POST", headers: { cookie: sessionCookie, origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
			assert.equal(start.status, 200);
			const authorization = new URL((await start.json()).url);
			assert.equal(authorization.searchParams.get("include_granted_scopes"), "false");
			assert.deepEqual(
				authorization.searchParams
					.get("scope")!
					.split(" ")
					.filter((scope) => scope.startsWith("https://www.googleapis.com/auth/")),
				[scopes[id]],
			);
			const callback = `https://clipify.us/api/auth/callback/${id}`;
			assert.equal(authorization.searchParams.get("redirect_uri"), callback);
			const cookie =
				sessionCookie +
				"; " +
				start.headers
					.getSetCookie()
					.map((value) => value.split(";")[0])
					.join("; ");
			const query = new URLSearchParams({ state: authorization.searchParams.get("state")!, ...(deny ? { error: "access_denied" } : { code: "fixture-code" }) });
			const response = await remote.handler(new Request(`${callback}?${query}`, { headers: { cookie } }));
			assert.equal(response.status, 302);
			if (!deny) {
				assert(response.headers.get("location")!.startsWith(`${origin}/api/auth/callback/${id}/oauth-proxy?`));
				const completed = await auth.handler(new Request(response.headers.get("location")!, { headers: { cookie } }));
				assert.equal(completed.status, 302);
			}
			if (event?.ok && !deny) assert.equal((await completeEventGoogleConnection(principal, eventProvider, new URL(event.link.callbackURL).searchParams.get("intent")!, fixture.db))?.connected, true);
		}
		for (const id of [...providers, "google-drive", "google-events-youtube"] as (keyof typeof scopes)[]) await link(id);
		const rows = (await fixture.pool.query("SELECT id,provider_id,account_id,access_token,refresh_token FROM auth.account ORDER BY provider_id")).rows;
		assert.equal(rows.length, 3);
		assert(rows.every((row) => row.account_id === "same-google-subject"));
		assert(rows.every((row) => !row.access_token.includes("-access") && !row.refresh_token.includes("-refresh")));
		await link("google-drive", true);
		assert.deepEqual((await fixture.pool.query("SELECT id,provider_id,account_id,access_token,refresh_token FROM auth.account ORDER BY provider_id")).rows, rows);
		for (const id of providers) {
			const row = rows.find((item) => item.provider_id === id)!;
			await fixture.pool.query("UPDATE auth.account SET access_token_expires_at=to_timestamp(0) WHERE id=$1", [row.id]);
			const provider = ctx.socialProviders.find((item) => typeof item !== "function" && item.id === id);
			assert(provider && typeof provider !== "function");
			let refreshes = 0;
			provider.refreshAccessToken = async (refreshToken) => {
				assert.equal(refreshToken, `${id}-refresh`);
				refreshes++;
				return { accessToken: `${id}-refreshed`, refreshToken: `${id}-rotated`, accessTokenExpiresAt: new Date(Date.now() + 3600000) };
			};
			if (id === "google") {
				const connection = await fixture.pool.query("INSERT INTO runner_provider_connections(owner_id,provider,channel_id,channel_name,encrypted_tokens) VALUES('creator','youtube','UCfixture','Fixture',$1) RETURNING id", [encryptString(JSON.stringify({ authAccountId: row.id, authUserId: "actor" }))]);
				const { withStreamingConnection } = await import("@/server/runner/provider-connections");
				for (let i = 0; i < 2; i++) assert.deepEqual(await fixture.db.transaction((tx) => withStreamingConnection(tx, "creator", connection.rows[0].id, async (context) => context.accessToken)), { success: true, value: `${id}-refreshed` });
			} else for (let i = 0; i < 2; i++) assert.equal((await eventGoogleToken("creator", id === "google-drive" ? "drive" : "youtube", fixture.db)).accessToken, `${id}-refreshed`);
			assert.equal(refreshes, 1);
		}
		assert.equal((await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie }) }))?.user.id, "actor");
		process.stdout.write(JSON.stringify({ independentLinks: 3, sameIdentity: true, deniedLinkPreserved: true, refreshes: 3, sessionPreserved: true }) + "\n");
	} finally {
		globalThis.fetch = previousFetch;
		await dbPool.end();
		await fixture.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
