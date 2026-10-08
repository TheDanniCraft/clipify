import { symmetricEncrypt } from "better-auth/crypto";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const capacityOne = process.argv[2] === "capacity-one";
	const secret = "isolated-provider-concurrency-secret-32chars";
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.BETTER_AUTH_SECRET = secret;
	process.env.TWITCH_CLIENT_ID = "isolated-provider-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-provider-secret";
	try {
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','provider-concurrency@example.invalid',true,now(),now())`);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_identity_links (creator_id,auth_user_id,source) VALUES ('creator','owner','twitch_onboarding')`);
		await fixture.pool.query(`INSERT INTO auth.account (id,account_id,provider_id,user_id,access_token,refresh_token,access_token_expires_at,updated_at) VALUES ('provider-account','twitch-owner','twitch','owner',$1,$2,now()+interval '1 hour',now())`, [await symmetricEncrypt({ key: secret, data: "isolated-concurrency-access" }), await symmetricEncrypt({ key: secret, data: "isolated-concurrency-refresh" })]);
		const { auth } = await import("@/auth/config");
		const { dbPool } = await import("@/db/client");
		if (capacityOne) dbPool.options.max = 1;
		const original = auth.api.getAccessToken;
		let reads = 0;
		Object.defineProperty(auth.api, "getAccessToken", {
			configurable: true,
			value: async (...args: unknown[]) => {
				reads++;
				// Model a short adapter scheduling delay after acquiring the credential lock.
				// The actual Better Auth storage/decryption operation still executes unchanged.
				await new Promise((resolve) => setTimeout(resolve, 100));
				return Reflect.apply(original, auth.api, args);
			},
		});
		const { getBetterAuthProviderAccessToken } = await import("@/server/provider-credentials");
		const started = performance.now();
		const outcomes = await Promise.allSettled(Array.from({ length: capacityOne ? 1 : 20 }, () => getBetterAuthProviderAccessToken("creator")));
		const elapsed = performance.now() - started;
		Object.defineProperty(auth.api, "getAccessToken", { configurable: true, value: original });
		const observer = await fixture.pool.connect();
		const lock = (await observer.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired", ["clipify:twitch:provider-account"])).rows[0].acquired;
		if (lock) await observer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", ["clipify:twitch:provider-account"]);
		observer.release();
		const healthy = (await dbPool.query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		console.log(JSON.stringify({ successes: outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value?.accessToken === "isolated-concurrency-access").length, failures: outcomes.filter((outcome) => outcome.status === "rejected").length, elapsed, reads, capacityRejected: outcomes.every((outcome) => outcome.status === "rejected" && outcome.reason instanceof Error && outcome.reason.message === "PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE"), lockReleased: lock, healthy }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
