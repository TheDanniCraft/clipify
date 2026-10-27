import { createHmac } from "node:crypto";
async function main() {
	const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname) || !/^\/mcp_[a-f0-9]+$/.test(databaseUrl.pathname)) throw new Error("ONBOARDING_PROBE_REQUIRES_DISPOSABLE_DATABASE");
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.USESEND_API_KEY = "";
	globalThis.fetch = async (input, init) => {
		if (String(input) !== "https://api.twitch.tv/helix/users") throw new Error("Unexpected external request in onboarding fixture");
		const id = new Headers(init?.headers).get("Authorization")?.replace("Bearer fixture-twitch:", "");
		return Response.json({ data: [{ id: process.argv[4] === "wrong-profile" ? "another-subject" : id, created_at: "2012-04-15T13:45:00Z" }] });
	};
	const { auth } = await import("@/auth/config");
	const { dbPool } = await import("@/db/client");
	const { completeTwitchSignIn, initializeCreator } = await import("@/server/creator-onboarding");
	const email = process.argv[2],
		creatorId = process.argv[3];
	if (!email || !creatorId) throw new Error("ONBOARDING_PROBE_INPUT_REQUIRED");
	try {
		const context = await auth.$context;
		const mode = process.argv[4];
		if (["retry", "initialize", "profile", "unlink-primary", "entitlements"].includes(mode)) {
			const { rows } = await dbPool.query("SELECT id,user_id,access_token,refresh_token FROM auth.account WHERE provider_id='twitch' AND account_id=$1", [creatorId]);
			const authUserId = rows[0]?.user_id;
			if (!authUserId) throw new Error("PROBE_TWITCH_ACCOUNT_MISSING");
			if (mode === "unlink-primary") {
				const session = await context.internalAdapter.createSession(authUserId);
				if (!session || typeof context.secret !== "string") throw new Error("FIXTURE_SESSION_REQUIRED");
				const signed = `${session.token}.${createHmac("sha256", context.secret).update(session.token).digest("base64")}`;
				const response = await auth.handler(new Request("http://127.0.0.1:3107/api/auth/unlink-account", { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3107", cookie: `${context.authCookies.sessionToken.name}=${signed}` }, body: JSON.stringify({ accountId: rows[0].id }) }));
				const body = await response.json();
				const after = await dbPool.query("SELECT access_token,refresh_token FROM auth.account WHERE id=$1", [rows[0].id]);
				await completeTwitchSignIn(creatorId, authUserId);
				process.stdout.write(JSON.stringify({ status: response.status, code: body.code, credentialsPreserved: after.rows[0]?.access_token === rows[0].access_token && after.rows[0]?.refresh_token === rows[0].refresh_token, signInStillWorks: true }) + "\n");
				return;
			}

			if (mode === "entitlements") {
				const { resolveUserEntitlements } = await import("@/app/lib/entitlements");
				const { rows: users } = await dbPool.query("SELECT id, plan FROM users WHERE id=$1", [creatorId]);
				process.stdout.write(JSON.stringify(await resolveUserEntitlements(users[0])) + "\n");
				return;
			}
			if (mode === "retry") await completeTwitchSignIn(creatorId, authUserId);
			if (mode === "initialize") await Promise.all(Array.from({ length: 8 }, () => initializeCreator(creatorId, new Date("2012-04-15T13:45:00Z"), authUserId)));
			if (mode === "profile") await context.internalAdapter.updateUser(authUserId, { name: "Updated Creator", email: `updated-${email}`, image: "https://example.invalid/updated.png" });
			process.stdout.write(JSON.stringify({ retried: true }) + "\n");
			return;
		}
		const create = (subject: string, address: string) => context.internalAdapter.createOAuthUser({ name: "OAuth Creator", email: address, emailVerified: mode !== "unverified", image: null }, { accountId: subject, providerId: mode === "non-twitch" ? "google" : "twitch", accessToken: `fixture-twitch:${subject}`, accessTokenExpiresAt: new Date(Date.now() + 3600_000) });
		if (process.argv[4] === "concurrent") {
			const results = await Promise.all(Array.from({ length: 4 }, (_, index) => create(`${creatorId}-${index}`, `${index}-${email}`)));
			process.stdout.write(JSON.stringify({ creators: results.map((result) => result.account.accountId) }) + "\n");
			return;
		}
		const result = await create(creatorId, email);
		process.stdout.write(JSON.stringify({ authUserId: result.user.id, accountId: result.account.accountId }) + "\n");
	} finally {
		await dbPool.end();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
