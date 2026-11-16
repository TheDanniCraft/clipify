import { createHmac } from "node:crypto";
async function main() {
	const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname) || !/^\/mcp_[a-f0-9]+$/.test(databaseUrl.pathname)) throw new Error("ONBOARDING_PROBE_REQUIRES_DISPOSABLE_DATABASE");
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.USESEND_API_KEY = "";
	globalThis.fetch = async (input, init) => {
		if (process.argv[4]?.startsWith("inventory") && String(input).startsWith("https://api.twitch.tv/helix/videos?")) return Response.json({ data: [], pagination: {} });
		if (String(input) !== "https://api.twitch.tv/helix/users") throw new Error("Unexpected external request in onboarding fixture");
		const id = new Headers(init?.headers).get("Authorization")?.replace("Bearer fixture-twitch:", "");
		return Response.json({ data: [{ id: process.argv[4] === "wrong-profile" ? "another-subject" : id, created_at: process.argv[4]?.startsWith("inventory") ? new Date(Date.now() - 40 * 86400000).toISOString() : "2012-04-15T13:45:00Z" }] });
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
		if (mode?.startsWith("inventory")) {
			const axios = (await import("axios")).default;
			const requests: Array<{ startedAt: string; endedAt: string }> = [];
			const clips =
				mode === "inventory-empty"
					? []
					: [1, 20].map((days) => ({ id: `inventory-${days}`, broadcaster_id: creatorId, broadcaster_name: "OAuth Creator", creator_id: creatorId, creator_name: "Fixture", video_id: "", game_id: "1", language: "en", title: `Clip ${days}`, view_count: 1, created_at: new Date(Date.now() - days * 86400000).toISOString(), thumbnail_url: "https://example.invalid/thumbnail", url: `https://clips.twitch.tv/inventory-${days}`, embed_url: "https://clips.twitch.tv/embed", duration: 30 }));
			axios.defaults.adapter = async (config) => {
				if (config.url !== "https://api.twitch.tv/helix/clips" || config.params.broadcaster_id !== creatorId) throw new Error("Unexpected inventory provider request");
				const { started_at: startedAt, ended_at: endedAt } = config.params;
				requests.push({ startedAt, endedAt });
				return { config, status: 200, statusText: "OK", headers: {}, data: { data: clips.filter((clip) => clip.created_at >= startedAt && clip.created_at <= endedAt), pagination: {} } };
			};
			const { runClipCrawlerBatch } = await import("@/server/clip-crawler/worker");
			for (let i = 0; i < 4; i++) await runClipCrawlerBatch({ creatorId, maxJobs: 1 });
			const rows = (await dbPool.query("SELECT value FROM \"twitchCache\" WHERE type='clip' AND key LIKE $1 ORDER BY key", [`clip:${creatorId}:%`])).rows;
			const state = (await dbPool.query("SELECT value FROM \"twitchCache\" WHERE type='clip' AND key=$1", [`clip-sync:${creatorId}`])).rows[0];
			process.stdout.write(
				JSON.stringify({
					clipIds: rows.map((row) => JSON.parse(row.value).clip.id).sort(),
					backfillComplete: state && JSON.parse(state.value).backfillComplete,
					jobs: (await dbPool.query("SELECT kind,last_completed_at IS NOT NULL AS completed FROM clip_crawl_jobs WHERE creator_id=$1 ORDER BY kind", [creatorId])).rows,
					historicalRequest: requests.some((request) => Date.parse(request.endedAt) < Date.now() - 7 * 86400000),
					overlays: (await dbPool.query("SELECT count(*)::int AS count FROM overlays WHERE owner_id=$1", [creatorId])).rows[0].count,
				}) + "\n",
			);
			return;
		}
		process.stdout.write(JSON.stringify({ authUserId: result.user.id, accountId: result.account.accountId }) + "\n");
	} finally {
		await dbPool.end();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
