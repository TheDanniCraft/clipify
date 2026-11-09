import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const origin = "http://127.0.0.1:3107";
	Object.assign(process.env, { DATABASE_URL: fixture.url, APP_ENV: "test", NEXT_PUBLIC_BASE_URL: origin, BETTER_AUTH_SECRET: "isolated-event-participant-secret-32-chars", TWITCH_CLIENT_ID: "fixture-client", TWITCH_CLIENT_SECRET: "fixture-secret", DISABLE_BACKGROUND_JOBS: "true", USESEND_API_KEY: "" });
	delete process.env.COOLIFY_URL;
	const { auth } = await import("@/auth/config");
	const { dbPool } = await import("@/db/client");
	const { TWITCH_ADDITIONAL_SCOPES } = await import("@/auth/providers/twitch");
	const previousFetch = globalThis.fetch;
	let creator = false;
	try {
		const ctx = await auth.$context;
		const provider = ctx.socialProviders.find((p) => typeof p !== "function" && p.id === "twitch");
		assert(provider && typeof provider !== "function");
		provider.validateAuthorizationCode = async () => ({ accessToken: "fixture-twitch:event-viewer", refreshToken: "viewer-refresh", accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes: ["openid", "user:read:email", ...(creator ? TWITCH_ADDITIONAL_SCOPES : [])] });
		provider.getUserInfo = async () => ({ user: { name: "Event Viewer", email: "viewer@example.invalid", emailVerified: true }, data: { sub: "event-viewer", preferred_username: "EventViewer", email: "viewer@example.invalid", email_verified: true, created_at: "2012-04-15T13:45:00Z" } });
		globalThis.fetch = async (input) => {
			assert.equal(String(input), "https://api.twitch.tv/helix/users");
			return Response.json({ data: [{ id: "event-viewer", created_at: "2012-04-15T13:45:00Z" }] });
		};
		const eventId = randomUUID();
		async function roundTrip(viewer: boolean) {
			creator = !viewer;
			const callbackURL = viewer ? `${origin}/events/${eventId}` : `${origin}/dashboard`;
			const started = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "twitch", callbackURL, errorCallbackURL: callbackURL, ...(viewer ? { additionalData: { eventParticipation: eventId } } : { scopes: TWITCH_ADDITIONAL_SCOPES }) }) }));
			assert.equal(started.status, 200);
			const authorize = new URL((await started.json()).url);
			const scopes = authorize.searchParams.get("scope")!.split(" ");
			if (viewer) assert(scopes.every((scope) => ["openid", "user:read:email"].includes(scope)));
			else assert(TWITCH_ADDITIONAL_SCOPES.every((scope) => scopes.includes(scope)));
			const stateCookie = started.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const returned = await auth.handler(new Request(`${origin}/api/auth/callback/twitch?code=fixture-code&state=${encodeURIComponent(authorize.searchParams.get("state")!)}`, { headers: { cookie: stateCookie } }));
			assert.equal(returned.status, 302);
			assert.equal(returned.headers.get("location"), callbackURL);
			const cookie = returned.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
			assert(session);
			return { cookie, session };
		}
		const first = await roundTrip(true);
		const second = await roundTrip(true);
		assert.equal(second.session.user.id, first.session.user.id);
		for (const table of ["users", "creator_accounts", "creator_identity_links", '"userSettings"', "entitlement_grants", "notification_outbox", "auth.member", "auth.organization"]) {
			const result = await fixture.pool.query(`SELECT count(*) FROM ${table}`);
			assert.equal(result.rows[0].count, "0", `${table} must remain empty for event viewers`);
		}
		const { getAuthActorContext } = await import("@/auth/session");
		assert.equal(await getAuthActorContext(new Headers({ cookie: second.cookie })), null);
		const promoted = await roundTrip(false);
		assert.equal(promoted.session.user.id, first.session.user.id);
		await roundTrip(false);
		for (const table of ["users", "creator_accounts", "creator_identity_links", "auth.member", "auth.organization"]) {
			const result = await fixture.pool.query(`SELECT count(*) FROM ${table}`);
			assert.equal(result.rows[0].count, "1", `${table} must be initialized exactly once`);
		}
		process.stdout.write(JSON.stringify({ viewerOnly: true, noCreatorEmails: true, returningViewer: true, intentionalPromotion: true, sameIdentity: true }) + "\n");
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
