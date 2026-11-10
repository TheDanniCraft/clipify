import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { genericOAuth, oAuthProxy } from "better-auth/plugins";
import { eventGoogleProviders, eventGoogleProviderIds, isGoogleProvider } from "@/auth/google-connections";
import { createMcpPostgresFixture } from "./postgres";
import { googleDiscovery } from "./google-discovery.mjs";

async function main() {
	const fixture = await createMcpPostgresFixture();
	const origin = "https://beta-560.clipify.cloud.thedannicraft.de";
	Object.assign(process.env, { DATABASE_URL: fixture.url, APP_ENV: "test", NEXT_PUBLIC_BASE_URL: origin, BETTER_AUTH_SECRET: "isolated-google-auth-secret-32-characters", OAUTH_PROXY_SECRET: "isolated-google-proxy-secret-32-characters", TWITCH_CLIENT_ID: "fixture-client", TWITCH_CLIENT_SECRET: "fixture-secret", YOUTUBE_CLIENT_ID: "fixture-google-client", YOUTUBE_CLIENT_SECRET: "fixture-google-secret", DISABLE_BACKGROUND_JOBS: "true" });
	delete process.env.COOLIFY_URL;
	const previousFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		assert.equal(String(input), "https://accounts.google.com/.well-known/openid-configuration");
		return Response.json(googleDiscovery);
	}) as typeof fetch;
	const { auth } = await import("@/auth/config");
	const { dbPool } = await import("@/db/client");
	try {
		assert.deepEqual(eventGoogleProviders({}), []);
		for (const id of ["google", ...Object.values(eventGoogleProviderIds)]) assert.equal(isGoogleProvider(id), true);
		assert.equal(isGoogleProvider("twitch"), false);
		await fixture.pool.query("INSERT INTO auth.\"user\"(id,name,email,email_verified) VALUES('actor','Fixture','actor@example.invalid',true)");
		const context = await auth.$context;
		const session = await context.internalAdapter.createSession("actor", false, {}, true);
		assert(session);
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const cookie = context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed);
		const production = betterAuth({ ...auth.options, baseURL: "https://clipify.us", plugins: [genericOAuth({ config: eventGoogleProviders() }), oAuthProxy({ currentURL: "https://clipify.us", productionURL: "https://clipify.us", secret: process.env.OAUTH_PROXY_SECRET })] });
		const remote = await production.$context;
		for (const [feature, id] of Object.entries(eventGoogleProviderIds)) {
			const scope = feature === "drive" ? "https://www.googleapis.com/auth/drive.file" : "https://www.googleapis.com/auth/youtube.readonly";
			const provider = remote.socialProviders.find((item) => typeof item !== "function" && item.id === id);
			assert(provider && typeof provider !== "function");
			assert(provider.idToken && provider.requiresIdTokenNonce);
			provider.validateAuthorizationCode = async () => ({ accessToken: `${id}-access`, refreshToken: `${id}-refresh`, accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes: ["openid", "email", "profile", scope] });
			provider.getUserInfo = async () => ({ user: { name: "Fixture", email: "actor@example.invalid", emailVerified: true }, data: { sub: "same-google-identity", email: "actor@example.invalid", email_verified: true } });
			const started = await auth.handler(new Request(`${origin}/api/auth/link-social`, { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ provider: id, scopes: [scope], callbackURL: `${origin}/dashboard`, disableRedirect: true }) }));
			assert.equal(started.status, 200);
			const url = new URL((await started.json()).url);
			assert.equal(url.searchParams.get("redirect_uri"), `https://clipify.us/api/auth/callback/${id}`);
			assert.equal(url.searchParams.get("include_granted_scopes"), "false");
			assert.deepEqual(
				url.searchParams
					.get("scope")!
					.split(" ")
					.filter((value) => value.startsWith("https://www.googleapis.com/auth/")),
				[scope],
			);
			const callback = await production.handler(new Request(`https://clipify.us/api/auth/callback/${id}?${new URLSearchParams({ code: "fixture-code", state: url.searchParams.get("state")! })}`));
			assert.equal(callback.status, 302);
			assert(callback.headers.get("location")!.startsWith(`${origin}/api/auth/callback/${id}/oauth-proxy?`));
			const stateCookies = started.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const completed = await auth.handler(new Request(callback.headers.get("location")!, { headers: { cookie: `${cookie}; ${stateCookies}` } }));
			assert.equal(completed.status, 302);
			assert.equal(completed.headers.get("location"), `${origin}/dashboard`);
		}
		const rows = (await fixture.pool.query("SELECT provider_id,account_id FROM auth.account WHERE user_id='actor' ORDER BY provider_id")).rows;
		assert.deepEqual(rows, [
			{ provider_id: "google-drive", account_id: "same-google-identity" },
			{ provider_id: "google-events-youtube", account_id: "same-google-identity" },
		]);
		assert.equal((await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.id, "actor");
		process.stdout.write(JSON.stringify({ providers: 2, stableCallbacks: true, proxyRoundTrips: 2, separateAccounts: true, sessionPreserved: true }) + "\n");
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
