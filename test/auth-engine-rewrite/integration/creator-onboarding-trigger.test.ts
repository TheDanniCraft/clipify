/** @jest-environment node */

import { randomUUID } from "node:crypto";
import { runMcpProbe } from "../../support/mcp/probe";
import { Pool, type PoolClient } from "pg";
import { installCreatorOnboardingTriggers } from "@/auth/onboarding-database-boundary";
import { createMcpPostgresFixture } from "../../support/mcp/postgres";

jest.setTimeout(60_000);

type ProvisionedRows = {
	creator: string;
	organization: string;
	identity: string;
	owner: string;
};

describe("TDD-US2-003 atomic Better Auth creator onboarding", () => {
	let pool: Pool;
	let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
	const previousDatabaseUrl = process.env.DATABASE_URL;

	beforeEach(async () => {
		fixture = await createMcpPostgresFixture();
		pool = fixture.pool;
		process.env.DATABASE_URL = fixture.url;
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await installCreatorOnboardingTriggers(client);
			await installCreatorOnboardingTriggers(client);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	});

	afterEach(async () => {
		if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = previousDatabaseUrl;
		await fixture?.close();
	});

	async function inRollback(operation: (client: PoolClient) => Promise<void>) {
		const client = await pool.connect();
		await client.query("BEGIN");
		try {
			await operation(client);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	async function provisioned(client: PoolClient, creatorId: string): Promise<ProvisionedRows> {
		const result = await client.query<ProvisionedRows>(
			`SELECT
				(SELECT count(*)::text FROM public.users WHERE id = $1) AS creator,
				(SELECT count(*)::text FROM auth.organization WHERE id = 'creator:' || $1) AS organization,
				(SELECT count(*)::text FROM public.creator_identity_links WHERE creator_id = $1) AS identity,
				(SELECT count(*)::text FROM auth.member m JOIN public.creator_accounts ca ON ca.organization_id = m.organization_id WHERE ca.creator_id = $1 AND m.role = 'owner') AS owner`,
			[creatorId],
		);
		return result.rows[0]!;
	}

	it("installs exactly one idempotent account trigger and one profile-sync trigger", async () => {
		const result = await pool.query<{ name: string }>(
			`SELECT tgname AS name
			 FROM pg_trigger
			 WHERE NOT tgisinternal
			   AND tgname IN ('clipify_twitch_creator_on_account_insert', 'clipify_twitch_creator_profile_sync')
			 ORDER BY tgname`,
		);
		expect(result.rows.map((row) => row.name)).toEqual(["clipify_twitch_creator_on_account_insert", "clipify_twitch_creator_profile_sync"]);
	});

	it("creates the stable creator, organization, identity link, and owner in the account transaction", async () => {
		await inRollback(async (client) => {
			const suffix = randomUUID();
			const authUserId = `test-auth-${suffix}`;
			const creatorId = `test-creator-${suffix}`;
			await client.query(`INSERT INTO auth.user (id, name, email, email_verified, image, created_at, updated_at) VALUES ($1, 'Creator Name', $2, true, 'https://example.invalid/avatar.png', now(), now())`, [authUserId, `${suffix}@example.invalid`]);
			await client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'twitch', $3, now(), now())`, [`test-account-${suffix}`, creatorId, authUserId]);

			expect(await provisioned(client, creatorId)).toEqual({ creator: "1", organization: "1", identity: "1", owner: "1" });
			const creator = await client.query("SELECT email, username, avatar, role::text, plan::text FROM public.users WHERE id = $1", [creatorId]);
			expect(creator.rows[0]).toEqual({ email: `${suffix}@example.invalid`, username: "Creator Name", avatar: "https://example.invalid/avatar.png", role: "user", plan: "free" });
			expect((await client.query("SELECT onboarding_pending FROM users WHERE id=$1", [creatorId])).rows[0].onboarding_pending).toBe(true);
		});
	});

	it("runs inside Better Auth's real createOAuthUser transaction", async () => {
		const suffix = randomUUID();
		const creatorId = `test-creator-${suffix}`;
		const email = `${suffix}@example.invalid`;
		const created = runMcpProbe("auth-onboarding-probe", [email, creatorId]) as { authUserId: string; accountId: string };

		try {
			expect(created.accountId).toBe(creatorId);
			const client = await pool.connect();
			try {
				expect(await provisioned(client, creatorId)).toEqual({ creator: "1", organization: "1", identity: "1", owner: "1" });
				const result = await client.query(
					`SELECT u.member_number, u.twitch_created_at, s.prefix, s.creator_page_visibility,
				 NOT u.onboarding_pending AS initialized,
				 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id AND source='reverse_trial' AND ends_at-starts_at=interval '7 days') AS trials,
				 (SELECT count(*)::int FROM notification_outbox WHERE dedupe_key LIKE 'benefit:%:granted' AND recipient=u.email) AS notices
				 FROM users u JOIN "userSettings" s ON s.id=u.id WHERE u.id=$1`,
					[creatorId],
				);
				expect(result.rows[0]).toMatchObject({ prefix: "!", creator_page_visibility: "discoverable", initialized: true, trials: 1, notices: 1 });
				expect(result.rows[0].member_number).toBeGreaterThan(0);
				expect(result.rows[0].twitch_created_at.toISOString()).toBe("2012-04-15T13:45:00.000Z");
			} finally {
				client.release();
			}
		} finally {
			await pool.query("DELETE FROM auth.user WHERE id = $1", [created.authUserId]);
			await pool.query("DELETE FROM public.users WHERE id = $1", [creatorId]);
			await pool.query("DELETE FROM auth.organization WHERE id = 'creator:' || $1", [creatorId]);
		}
	});

	it("rolls the Better Auth user and account back when creator provisioning rejects an unverified identity", async () => {
		const suffix = randomUUID();
		const authUserId = `test-auth-${suffix}`;
		const creatorId = `test-creator-${suffix}`;
		const client = await pool.connect();
		await client.query("BEGIN");
		await client.query(`INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) VALUES ($1, 'Unverified', $2, false, now(), now())`, [authUserId, `${suffix}@example.invalid`]);
		await expect(client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'twitch', $3, now(), now())`, [`test-account-${suffix}`, creatorId, authUserId])).rejects.toThrow();
		await client.query("ROLLBACK");
		client.release();

		const persisted = await pool.query(`SELECT (SELECT count(*) FROM auth.user WHERE id = $1)::int AS users, (SELECT count(*) FROM auth.account WHERE account_id = $2 AND provider_id = 'twitch')::int AS accounts, (SELECT count(*) FROM public.users WHERE id = $2)::int AS creators`, [authUserId, creatorId]);
		expect(persisted.rows[0]).toEqual({ users: 0, accounts: 0, creators: 0 });
	});

	it("rolls back earlier domain writes when a later ownership invariant fails", async () => {
		const suffix = randomUUID();
		const authUserId = `test-auth-${suffix}`;
		const creatorId = `test-creator-${suffix}`;
		const existingOrganizationId = `test-existing-org-${suffix}`;
		await pool.query(`INSERT INTO public.users (id, email, username, avatar, role, plan, created_at, updated_at, last_login) VALUES ($1, $2, 'Original Creator', '', 'user', 'free', now(), now(), now())`, [creatorId, `original-${suffix}@example.invalid`]);
		await pool.query(`INSERT INTO auth.organization (id, name, slug, created_at) VALUES ($1, 'Existing Organization', $2, now())`, [existingOrganizationId, `existing-${suffix}`]);
		await pool.query(`INSERT INTO public.creator_accounts (organization_id, creator_id, status, created_at, updated_at) VALUES ($1, $2, 'active', now(), now())`, [existingOrganizationId, creatorId]);

		try {
			const client = await pool.connect();
			await client.query("BEGIN");
			await client.query(`INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) VALUES ($1, 'Replacement Creator', $2, true, now(), now())`, [authUserId, `replacement-${suffix}@example.invalid`]);
			await expect(client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'twitch', $3, now(), now())`, [`test-account-${suffix}`, creatorId, authUserId])).rejects.toThrow();
			await client.query("ROLLBACK");
			client.release();

			const persisted = await pool.query(
				`SELECT
					(SELECT username FROM public.users WHERE id = $1) AS username,
					(SELECT email FROM public.users WHERE id = $1) AS email,
					(SELECT count(*)::int FROM auth.organization WHERE id = 'creator:' || $1) AS new_organizations,
					(SELECT count(*)::int FROM public.creator_identity_links WHERE creator_id = $1) AS identity_links,
					(SELECT count(*)::int FROM auth.user WHERE id = $2) AS auth_users,
					(SELECT count(*)::int FROM auth.account WHERE account_id = $1 AND provider_id = 'twitch') AS auth_accounts`,
				[creatorId, authUserId],
			);
			expect(persisted.rows[0]).toEqual({
				username: "Original Creator",
				email: `original-${suffix}@example.invalid`,
				new_organizations: 0,
				identity_links: 0,
				auth_users: 0,
				auth_accounts: 0,
			});
		} finally {
			await pool.query("DELETE FROM public.creator_accounts WHERE creator_id = $1", [creatorId]);
			await pool.query("DELETE FROM public.users WHERE id = $1", [creatorId]);
			await pool.query("DELETE FROM auth.organization WHERE id = $1", [existingOrganizationId]);
		}
	});

	it("supports a clean retry and keeps returning account writes idempotent", async () => {
		await inRollback(async (client) => {
			const suffix = randomUUID();
			const authUserId = `test-auth-${suffix}`;
			const creatorId = `test-creator-${suffix}`;
			const accountId = `test-account-${suffix}`;
			await client.query(`INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) VALUES ($1, 'Retry Creator', $2, true, now(), now())`, [authUserId, `${suffix}@example.invalid`]);
			await client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'twitch', $3, now(), now())`, [accountId, creatorId, authUserId]);
			await client.query(`UPDATE auth.account SET updated_at = now() WHERE id = $1`, [accountId]);
			expect((await client.query("SELECT onboarding_pending FROM users WHERE id=$1", [creatorId])).rows[0].onboarding_pending).toBe(true);

			expect(await provisioned(client, creatorId)).toEqual({ creator: "1", organization: "1", identity: "1", owner: "1" });
		});
	});

	it("synchronizes verified Better Auth profile changes without changing ownership", async () => {
		await inRollback(async (client) => {
			const suffix = randomUUID();
			const authUserId = `test-auth-${suffix}`;
			const creatorId = `test-creator-${suffix}`;
			await client.query(`INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) VALUES ($1, 'Before', $2, true, now(), now())`, [authUserId, `${suffix}@example.invalid`]);
			await client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'twitch', $3, now(), now())`, [`test-account-${suffix}`, creatorId, authUserId]);
			await client.query(`UPDATE auth.user SET name = 'After', email = $2, image = 'https://example.invalid/after.png', updated_at = now() WHERE id = $1`, [authUserId, `changed-${suffix}@example.invalid`]);

			const creator = await client.query("SELECT email, username, avatar FROM public.users WHERE id = $1", [creatorId]);
			expect(creator.rows[0]).toEqual({ email: `changed-${suffix}@example.invalid`, username: "After", avatar: "https://example.invalid/after.png" });
			expect(await provisioned(client, creatorId)).toEqual({ creator: "1", organization: "1", identity: "1", owner: "1" });
		});
	});

	it("does not provision creator ownership for non-Twitch accounts", async () => {
		await inRollback(async (client) => {
			const suffix = randomUUID();
			const authUserId = `test-auth-${suffix}`;
			const externalId = `test-email-${suffix}`;
			await client.query(`INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) VALUES ($1, 'Team Member', $2, true, now(), now())`, [authUserId, `${suffix}@example.invalid`]);
			await client.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'credential', $3, now(), now())`, [`test-account-${suffix}`, externalId, authUserId]);

			expect(await provisioned(client, externalId)).toEqual({ creator: "0", organization: "0", identity: "0", owner: "0" });
		});
	});

	it("retries concurrent initialization without restarting expired trials or replacing customized settings", async () => {
		const suffix = randomUUID();
		const creatorId = `retry-${suffix}`;
		const created = runMcpProbe("auth-onboarding-probe", [`${suffix}@example.invalid`, creatorId]);
		await pool.query(`UPDATE "userSettings" SET prefix='?', marketing_opt_in=false, creator_page_visibility='unlisted' WHERE id=$1`, [creatorId]);
		await pool.query(`UPDATE entitlement_grants SET starts_at=now()-interval '10 days', ends_at=now()-interval '3 days' WHERE user_id=$1 AND source='reverse_trial'`, [creatorId]);
		await pool.query(`UPDATE users SET onboarding_pending=true WHERE id=$1`, [creatorId]);
		const before = (await pool.query("SELECT member_number FROM users WHERE id=$1", [creatorId])).rows[0].member_number;
		expect(runMcpProbe("auth-onboarding-probe", [`${suffix}@example.invalid`, creatorId, "initialize"])).toEqual({ initialized: true });
		const result = await pool.query(
			`SELECT u.member_number,s.prefix,s.marketing_opt_in,s.creator_page_visibility,
		 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id AND source='reverse_trial') AS trials,
		 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id AND source='reverse_trial' AND ends_at>now()) AS active_trials
		 FROM users u JOIN "userSettings" s ON s.id=u.id WHERE u.id=$1`,
			[creatorId],
		);
		expect(result.rows[0]).toEqual({ member_number: before, prefix: "?", marketing_opt_in: false, creator_page_visibility: "unlisted", trials: 1, active_trials: 0 });
		expect(created.authUserId).toBeTruthy();
	});

	it("rolls mandatory initialization back together and recovers on retry", async () => {
		const suffix = randomUUID();
		const creatorId = `failure-${suffix}`;
		await pool.query(`INSERT INTO auth.user (id,name,email,email_verified,created_at,updated_at) VALUES ($1,'Retry',$2,true,now(),now())`, [suffix, `${suffix}@example.invalid`]);
		await pool.query(`INSERT INTO auth.account (id,account_id,provider_id,user_id,created_at,updated_at) VALUES ($1,$2,'twitch',$1,now(),now())`, [suffix, creatorId]);
		await pool.query(`CREATE FUNCTION public.reject_test_trial() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_TRIAL_FAILURE'; END $$;
		 CREATE TRIGGER reject_test_trial BEFORE INSERT ON entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.reject_test_trial()`);
		expect(() => runMcpProbe("auth-onboarding-probe", [`${suffix}@example.invalid`, creatorId, "initialize"])).toThrow();
		const result = await pool.query(
			`SELECT u.member_number,u.onboarding_pending,
		 (SELECT count(*)::int FROM "userSettings" WHERE id=u.id) AS settings,
		 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id) AS grants
		 FROM users u WHERE u.id=$1`,
			[creatorId],
		);
		expect(result.rows[0]).toEqual({ member_number: null, onboarding_pending: true, settings: 0, grants: 0 });
		await pool.query("DROP TRIGGER reject_test_trial ON entitlement_grants");
		expect(runMcpProbe("auth-onboarding-probe", [`${suffix}@example.invalid`, creatorId, "initialize"])).toEqual({ initialized: true });
	});

	it("does not make an existing paid, manually disabled creator eligible during identity linking", async () => {
		await inRollback(async (client) => {
			const id = randomUUID();
			await client.query(`INSERT INTO users (id,email,username,avatar,role,plan,member_number,disabled,disable_type) VALUES ($1,$2,'Existing','','user','pro',700001,true,'manual')`, [id, `${id}@example.invalid`]);
			await client.query(`INSERT INTO auth.user (id,name,email,email_verified,created_at,updated_at) VALUES ($1,'Existing',$2,true,now(),now())`, [id, `${id}@example.invalid`]);
			await client.query(`INSERT INTO auth.account (id,account_id,provider_id,user_id,created_at,updated_at) VALUES ($1,$1,'twitch',$1,now(),now())`, [id]);
			expect((await client.query("SELECT onboarding_pending FROM users WHERE id=$1", [id])).rows[0].onboarding_pending).toBe(false);
			expect((await client.query("SELECT plan,member_number,disabled,disable_type FROM users WHERE id=$1", [id])).rows[0]).toEqual({ plan: "pro", member_number: 700001, disabled: true, disable_type: "manual" });
		});
	});

	it("fails an invalid first sign-in and completes it on retry without losing signup eligibility", async () => {
		const id = `profile-${randomUUID()}`;
		expect(() => runMcpProbe("auth-onboarding-probe", [`${id}@example.invalid`, id, "wrong-profile"])).toThrow();
		const before = (await pool.query("SELECT twitch_created_at,onboarding_pending FROM users WHERE id=$1", [id])).rows[0];
		expect(before.twitch_created_at.toISOString()).toBe("2016-05-01T00:00:00.000Z");
		expect(before.onboarding_pending).toBe(true);
		runMcpProbe("auth-onboarding-probe", [`${id}@example.invalid`, id, "retry"]);
		const after = (
			await pool.query(
				`SELECT u.twitch_created_at,u.onboarding_pending,
		 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id AND source='reverse_trial') AS trials
		 FROM users u WHERE u.id=$1`,
				[id],
			)
		).rows[0];
		expect(after.twitch_created_at.toISOString()).toBe("2012-04-15T13:45:00.000Z");
		expect(after.onboarding_pending).toBe(false);
		expect(after.trials).toBe(1);
	});

	it("allocates unique membership numbers and complete benefits for concurrent real Better Auth signups", async () => {
		const id = `concurrent-${randomUUID()}`;
		const result = runMcpProbe("auth-onboarding-probe", [`${id}@example.invalid`, id, "concurrent"]);
		const rows = (
			await pool.query(
				`SELECT u.member_number,NOT u.onboarding_pending AS initialized,s.prefix,
		 (SELECT count(*)::int FROM entitlement_grants WHERE user_id=u.id AND source='reverse_trial') AS trials
		 FROM users u JOIN "userSettings" s ON s.id=u.id WHERE u.id=ANY($1::varchar[])`,
				[result.creators],
			)
		).rows;
		expect(rows).toHaveLength(4);
		expect(new Set(rows.map((row) => row.member_number)).size).toBe(4);
		for (const row of rows) {
			expect(row.member_number).toBeGreaterThan(0);
			expect(row.initialized).toBe(true);
			expect(row).toMatchObject({ prefix: "!", trials: 1 });
		}
	});
});
