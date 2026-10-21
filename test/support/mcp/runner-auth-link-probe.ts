import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { oAuthProxy } from "better-auth/plugins";
import { symmetricEncrypt } from "better-auth/crypto";
import { createMcpPostgresFixture } from "./postgres";

async function main() {
	const fixture = await createMcpPostgresFixture();
	const preview = process.argv[2] === "preview";
	const google = process.argv[3] === "google";
	const streamingProvider = google ? ("youtube" as const) : ("twitch" as const);
	const providerId = google ? "google" : "twitch";
	const providerCallback = `https://clipify.us/api/auth/callback/${providerId}`;
	const origin = preview ? "https://beta-519.clipify.cloud.thedannicraft.de" : "https://clipify.us";
	Object.assign(process.env, { DATABASE_URL: fixture.url, APP_ENV: "test", NEXT_PUBLIC_BASE_URL: origin, BETTER_AUTH_SECRET: "isolated-runner-auth-secret-32-characters", OAUTH_PROXY_SECRET: "isolated-runner-proxy-secret-32-characters", TWITCH_CLIENT_ID: "fixture-client", TWITCH_CLIENT_SECRET: "fixture-secret", YOUTUBE_CLIENT_ID: "fixture-google-client", YOUTUBE_CLIENT_SECRET: "fixture-google-secret", DISABLE_BACKGROUND_JOBS: "true" });
	delete process.env.COOLIFY_URL;
	const { auth } = await import("@/auth/config");
	const { dbPool } = await import("@/db/client");
	const previousFetch = globalThis.fetch;
	try {
		await fixture.pool.query("INSERT INTO auth.\"user\"(id,name,email,email_verified) VALUES('actor','Fixture','actor@example.invalid',true)");
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('creator','actor@example.invalid','Fixture','','user','pro')");
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('creator-org','Fixture','fixture',now())");
		await fixture.pool.query("INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('creator','creator-org','active')");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('member','creator-org','actor','owner',now())");
		const ctx = await auth.$context;
		const session = await ctx.internalAdapter.createSession("actor", false, { activeOrganizationId: "creator-org" }, true);
		assert(session);
		const signed = session.token + "." + createHmac("sha256", ctx.secret).update(session.token).digest("base64");
		let cookie = ctx.authCookies.sessionToken.name + "=" + encodeURIComponent(signed);
		await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,scope,refresh_token,access_token,access_token_expires_at,updated_at) VALUES('twitch-account','42','twitch','actor','openid,user:read:email',$1,$2,now()+interval '1 hour',now())", [await symmetricEncrypt({ key: ctx.secretConfig, data: "initial-refresh" }), await symmetricEncrypt({ key: ctx.secretConfig, data: "initial-access" })]);
		const remote = preview ? betterAuth({ ...auth.options, baseURL: "https://clipify.us", plugins: [oAuthProxy({ currentURL: "https://clipify.us", productionURL: "https://clipify.us", secret: process.env.OAUTH_PROXY_SECRET, maxAge: 60 })] }) : auth;
		let tokenCallback = "";
		const scopes = google ? ["openid", "email", "profile", "https://www.googleapis.com/auth/youtube.force-ssl"] : ["openid", "user:read:email", "channel:read:stream_key", "channel:manage:broadcast"];
		for (const instance of new Set([auth, remote])) {
			const context = await instance.$context;
			const provider = context.socialProviders.find((item) => typeof item !== "function" && item.id === providerId);
			assert(provider && typeof provider !== "function");
			provider.validateAuthorizationCode = async ({ redirectURI }) => {
				tokenCallback = redirectURI;
				return { accessToken: "linked-access", refreshToken: "linked-refresh", accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes };
			};
			provider.getUserInfo = async () => ({ user: { name: google ? "YouTube Brand" : "Fixture", email: google ? "youtube-owner@example.invalid" : "actor@example.invalid", emailVerified: true }, data: { sub: google ? "google-subject" : "42", preferred_username: google ? "YouTube Brand" : "Fixture", email: google ? "youtube-owner@example.invalid" : "actor@example.invalid", email_verified: true } });
		}
		globalThis.fetch = (async (value: RequestInfo | URL) => {
			assert.equal(String(value), google ? "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true" : "https://api.twitch.tv/helix/users");
			return new Response(JSON.stringify(google ? { items: [{ id: "UCfixture", snippet: { title: "Fixture" } }] } : { data: [{ id: "42", display_name: "Fixture" }] }));
		}) as typeof fetch;
		const { beginStreamingConnection, completeStreamingConnection, withStreamingConnection } = await import("@/server/runner/provider-connections");
		const principal = { kind: "session" as const, authUserId: "actor", sessionId: session.id, authenticatedAt: session.createdAt, organizationId: "creator-org" };
		// asResponse exercises actual cookie propagation at Better Auth's HTTP boundary.
		const begun = await beginStreamingConnection(principal, { ownerId: "creator", provider: streamingProvider }, fixture.db, Date.now, new Headers({ cookie, origin }));
		assert(begun.success);
		const authorization = new URL(begun.url);
		assert.equal(authorization.searchParams.get("redirect_uri"), providerCallback);
		assert(scopes.every((scope) => authorization.searchParams.get("scope")!.split(" ").includes(scope)));
		// Read the state cookie issued by a matching direct HTTP request for the full round trip.
		const { providerLinkRequest } = await import("@/server/runner/provider-contract");
		const intentRow = (await fixture.pool.query("SELECT digest FROM runner_provider_states")).rows[0];
		assert(intentRow);
		// The callback URL is retained in Better Auth's private verification state.
		const verification = (await fixture.pool.query("SELECT value FROM auth.verification WHERE value LIKE '%runnerConnectionIntent%' ORDER BY created_at DESC LIMIT 1")).rows[0];
		assert(verification);
		const stateData = JSON.parse(verification.value);
		const intent = stateData.runnerConnectionIntent;
		assert.equal(typeof intent, "string");
		const started = await auth.handler(new Request(`${origin}/api/auth/link-social`, { method: "POST", headers: { cookie, origin, "Content-Type": "application/json" }, body: JSON.stringify(providerLinkRequest(streamingProvider, origin, intent)) }));
		assert.equal(started.status, 200);
		const body = await started.json();
		cookie +=
			"; " +
			started.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
		const state = new URL(body.url).searchParams.get("state")!;
		const returned = await remote.handler(new Request(`${providerCallback}?code=fixture-code&state=${encodeURIComponent(state)}`, { headers: preview ? {} : { cookie } }));
		assert.equal(returned.status, 302);
		let location = returned.headers.get("location")!;
		if (preview) {
			assert(location.startsWith(origin + `/api/auth/callback/${providerId}/oauth-proxy?`));
			const completed = await auth.handler(new Request(location, { headers: { cookie } }));
			assert.equal(completed.status, 302);
			location = completed.headers.get("location")!;
		}
		assert.equal(tokenCallback, providerCallback);
		assert.equal(location, providerLinkRequest(streamingProvider, origin, intent).callbackURL);
		const result = await completeStreamingConnection(principal, streamingProvider, intent, fixture.db);
		assert(result.success);
		const output = await fixture.db.transaction((tx) => withStreamingConnection(tx, "creator", result.connection.id, async (context) => context.accessToken));
		assert.deepEqual(output, { success: true, value: "linked-access" });
		assert.equal((await fixture.pool.query('SELECT count(*) FROM auth."user"')).rows[0].count, "1");
		assert.equal((await fixture.pool.query("SELECT count(*) FROM auth.account")).rows[0].count, google ? "2" : "1");
		const stillSignedIn = await auth.api.getSession({ headers: new Headers({ cookie }) });
		assert.equal(stillSignedIn?.user.id, "actor");
		assert.equal(stillSignedIn?.user.email, "actor@example.invalid");
		assert.equal(stillSignedIn?.user.name, "Fixture");
		// A linked provider logs into the same user; normal Twitch login must not narrow its Runner grant.
		if (!google)
			for (const instance of new Set([auth, remote])) {
				const context = await instance.$context;
				const provider = context.socialProviders.find((item) => typeof item !== "function" && item.id === "twitch");
				assert(provider && typeof provider !== "function");
				provider.validateAuthorizationCode = async () => ({ accessToken: "login-only-access", refreshToken: "login-only-refresh", accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes: ["openid", "user:read:email"] });
			}
		async function roundTrip(path: "sign-in/social" | "link-social", body: Record<string, unknown>) {
			const start = await auth.handler(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin, "Content-Type": "application/json", ...(path === "link-social" ? { cookie } : {}) }, body: JSON.stringify({ provider: providerId, callbackURL: origin + "/dashboard", errorCallbackURL: origin + "/dashboard", ...body }) }));
			assert.equal(start.status, 200);
			const authorize = new URL((await start.json()).url);
			if (path === "sign-in/social") assert(!authorize.searchParams.get("scope")!.includes(google ? "youtube.force-ssl" : "channel:read:stream_key"));
			const cookies = start.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			let returned = await remote.handler(new Request(`${providerCallback}?code=fixture-code&state=${encodeURIComponent(authorize.searchParams.get("state")!)}`, { headers: preview ? {} : { cookie: cookies } }));
			assert.equal(returned.status, 302);
			if (preview && returned.headers.get("location")!.startsWith(origin + `/api/auth/callback/${providerId}/oauth-proxy?`)) {
				returned = await auth.handler(new Request(returned.headers.get("location")!, { headers: { cookie: cookies } }));
				assert.equal(returned.status, 302);
			}
			return returned;
		}
		const loggedIn = await roundTrip("sign-in/social", {});
		assert.equal(loggedIn.headers.get("location"), origin + "/dashboard");
		const loginCookie = loggedIn.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		const linkedSession = await auth.api.getSession({ headers: new Headers({ cookie: loginCookie }) });
		assert.equal(linkedSession?.user.id, "actor");
		assert.equal(linkedSession.user.email, "actor@example.invalid");
		assert.deepEqual(await fixture.db.transaction((tx) => withStreamingConnection(tx, "creator", result.connection.id, async (context) => context.accessToken)), { success: true, value: "linked-access" });
		if (google) {
			for (const instance of new Set([auth, remote])) {
				const context = await instance.$context;
				const provider = context.socialProviders.find((item) => typeof item !== "function" && item.id === "google");
				assert(provider && typeof provider !== "function");
				provider.getUserInfo = async () => ({ user: { name: "Other Google", email: "actor@example.invalid", emailVerified: true }, data: { sub: "other-google", email: "actor@example.invalid", email_verified: true } });
			}
			const refused = await roundTrip("sign-in/social", {});
			assert.equal(new URL(refused.headers.get("location")!).searchParams.get("error"), "account_not_linked");
			assert.equal((await fixture.pool.query('SELECT count(*) FROM auth."user"')).rows[0].count, "1");
			assert.equal((await fixture.pool.query("SELECT count(*) FROM auth.account")).rows[0].count, "2");
			await fixture.pool.query(`INSERT INTO auth."user"(id,name,email,email_verified) VALUES('other','Other','other@example.invalid',true)`);
			await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,updated_at) VALUES('other-google-account','other-google','google','other',now())");
			const conflict = await roundTrip("link-social", { scopes: ["https://www.googleapis.com/auth/youtube.force-ssl"] });
			assert.equal(new URL(conflict.headers.get("location")!).searchParams.get("error"), "account_already_linked_to_different_user");
			assert.equal((await fixture.pool.query("SELECT user_id FROM auth.account WHERE id='other-google-account'")).rows[0].user_id, "other");
		}
		// Background broadcasts refresh the same encrypted Better Auth account, without copying tokens.
		const linkedAccountId = (await fixture.pool.query("SELECT id FROM auth.account WHERE user_id='actor' AND provider_id=$1", [providerId])).rows[0].id;
		await fixture.pool.query("UPDATE auth.account SET access_token_expires_at=to_timestamp(0) WHERE id=$1", [linkedAccountId]);
		const refreshingProvider = ctx.socialProviders.find((item) => typeof item !== "function" && item.id === providerId);
		assert(refreshingProvider && typeof refreshingProvider !== "function");
		let refreshes = 0;
		refreshingProvider.refreshAccessToken = async (refreshToken) => {
			assert.equal(refreshToken, "linked-refresh");
			refreshes++;
			return { accessToken: "refreshed-access", refreshToken: "rotated-refresh", accessTokenExpiresAt: new Date(Date.now() + 3600000) };
		};
		for (let index = 0; index < 2; index++) {
			await fixture.db.transaction(async (tx): Promise<void> => {
				const refreshed = await withStreamingConnection<string>(tx, "creator", result.connection.id, async (context) => context.accessToken);
				assert.deepEqual(refreshed, { success: true, value: "refreshed-access" });
			});
		}
		assert.equal(refreshes, 1);
		process.stdout.write(JSON.stringify({ preview, provider: providerId, callback: tokenCallback, linked: true, sameSession: true }) + "\n");
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
