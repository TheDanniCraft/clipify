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
		if (["retry", "initialize", "profile"].includes(mode)) {
			const { rows } = await dbPool.query("SELECT user_id FROM auth.account WHERE provider_id='twitch' AND account_id=$1", [creatorId]);
			const authUserId = rows[0]?.user_id;
			if (!authUserId) throw new Error("PROBE_TWITCH_ACCOUNT_MISSING");
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
