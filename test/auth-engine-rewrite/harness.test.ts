/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import { ControlledClock, DeterministicMailAdapter, agencyPermissionIntersection, createAuthTestDatabase, createDeterministicTokenGenerator, permissionMatrix, recentAuthBoundary, resetAuthTestDatabase, signStripePayload, twitchFailureFixtures } from "../support/auth-engine-rewrite";

describe("auth rewrite deterministic harness", () => {
	it("creates and resets isolated PostgreSQL schemas", async () => {
		const database = await createAuthTestDatabase();
		try {
			await database.exec("CREATE TABLE auth.fixture (id integer PRIMARY KEY)");
			await resetAuthTestDatabase(database);
			const result = await database.query<{ auth_exists: boolean }>("SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') AS auth_exists");
			expect(result.rows).toEqual([{ auth_exists: true }]);
		} finally {
			await database.close();
		}
	}, 30_000);

	it("holds exact recent-auth and deterministic token boundaries", () => {
		const clock = new ControlledClock();
		const boundary = recentAuthBoundary(clock.now());
		const nextToken = createDeterministicTokenGenerator("fixture");
		expect(boundary.inside.getTime()).toBeGreaterThan(boundary.exact.getTime());
		expect(boundary.outside.getTime()).toBeLessThan(boundary.exact.getTime());
		expect([nextToken(), nextToken()]).toEqual(["fixture-000001", "fixture-000002"]);
	});

	it("captures one redacted transactional email per dedupe key", async () => {
		const mail = new DeterministicMailAdapter();
		const message = { to: "member@example.invalid", template: "invitation", dedupeKey: "invite-1", payload: { invitationToken: "secret", accountName: "Fixture" } };
		expect(await mail.send(message)).toMatchObject({ duplicate: false });
		expect(await mail.send(message)).toMatchObject({ duplicate: true });
		expect(mail.sent[0]?.payload).toEqual({ invitationToken: "[REDACTED]", accountName: "Fixture" });
	});

	it("provides authenticated Stripe and complete permission fixtures", () => {
		expect(signStripePayload("{}", "whsec_test", 1)).toMatch(/^t=1,v1=[a-f0-9]{64}$/);
		expect(permissionMatrix()).toHaveLength(116);
		expect(agencyPermissionIntersection(["overlay:read", "overlay:delete"], ["overlay:read"])).toEqual(["overlay:read"]);
	});

	it("includes negative Twitch credential and scope states", () => {
		expect(twitchFailureFixtures.insufficientScopes.scopes).toEqual(["openid"]);
		expect(twitchFailureFixtures.revokedCredential.revoked).toBe(true);
	});
});
