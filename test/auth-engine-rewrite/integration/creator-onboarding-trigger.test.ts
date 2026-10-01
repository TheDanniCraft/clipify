/** @jest-environment node */

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Pool, type PoolClient } from "pg";
import { installCreatorOnboardingTriggers } from "@/auth/onboarding-database-boundary";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

type ProvisionedRows = {
	creator: string;
	organization: string;
	identity: string;
	owner: string;
};

describePostgres("TDD-US2-003 atomic Better Auth creator onboarding", () => {
	let pool: Pool;

	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 2 });
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

	afterAll(async () => {
		await pool.end();
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
		});
	});

	it("runs inside Better Auth's real createOAuthUser transaction", async () => {
		const suffix = randomUUID();
		const creatorId = `test-creator-${suffix}`;
		const email = `${suffix}@example.invalid`;
		const invocation = spawnSync(
			"bun",
			[
				"-e",
				`import { auth } from "./src/auth/config.ts";
				 const context = await auth.$context;
				 const result = await context.internalAdapter.createOAuthUser(
				   { name: "OAuth Creator", email: process.env.TEST_AUTH_EMAIL, emailVerified: true, image: null },
				   { accountId: process.env.TEST_CREATOR_ID, providerId: "twitch" }
				 );
				 process.stdout.write(JSON.stringify({ authUserId: result.user.id, accountId: result.account.accountId }));
				 process.exit(0);`,
			],
			{
				cwd: process.cwd(),
				encoding: "utf8",
				env: { ...process.env, APP_ENV: "test", TEST_AUTH_EMAIL: email, TEST_CREATOR_ID: creatorId },
			},
		);

		expect(invocation.stderr).toBe("");
		expect(invocation.status).toBe(0);
		const created = JSON.parse(invocation.stdout) as { authUserId: string; accountId: string };
		try {
			expect(created.accountId).toBe(creatorId);
			const client = await pool.connect();
			try {
				expect(await provisioned(client, creatorId)).toEqual({ creator: "1", organization: "1", identity: "1", owner: "1" });
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
});
