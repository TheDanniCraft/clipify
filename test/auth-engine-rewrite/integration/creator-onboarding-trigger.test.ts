/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runMcpProbe } from "../../support/mcp/probe";
import { createMcpPostgresFixture } from "../../support/mcp/postgres";

jest.setTimeout(90_000);

describe("Better Auth hooks own Clipify creator setup", () => {
	let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
	const savedDatabaseUrl = process.env.DATABASE_URL;
	beforeEach(async () => {
		fixture = await createMcpPostgresFixture({ empty: true });
		process.env.DATABASE_URL = fixture.url;
		migrate();
	});
	afterEach(async () => {
		if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = savedDatabaseUrl;
		await fixture?.close();
	});
	function migrate() {
		return execFileSync(process.execPath, [resolve("scripts/run-migrations.mjs")], { env: { ...process.env, DATABASE_URL: fixture.url }, encoding: "utf8", timeout: 30_000 });
	}
	function probe(id: string, mode?: string) {
		return runMcpProbe("auth-onboarding-probe", [`${id}@example.invalid`, id, ...(mode ? [mode] : [])], 60_000);
	}
	async function state(id: string) {
		return (
			await fixture.pool.query(
				`SELECT u.id,u.plan,u.disabled,u.disable_type,u.member_number,u.onboarding_pending,
			u.twitch_created_at,s.prefix,s.marketing_opt_in,s.creator_page_visibility,
			(SELECT count(*)::int FROM entitlement_grants g WHERE g.user_id=u.id AND g.source='reverse_trial' AND g.ends_at-g.starts_at=interval '168 hours') AS trials,
			(SELECT count(*)::int FROM auth.member m JOIN creator_accounts a ON a.organization_id=m.organization_id WHERE a.creator_id=u.id AND m.role='owner') AS owners,
			(SELECT count(*)::int FROM creator_identity_links l WHERE l.creator_id=u.id) AS links
			FROM users u LEFT JOIN "userSettings" s ON s.id=u.id WHERE u.id=$1`,
				[id],
			)
		).rows[0];
	}
	async function expectComplete(id: string) {
		const row = await state(id);
		expect(row).toMatchObject({ plan: "free", onboarding_pending: false, prefix: "!", creator_page_visibility: "discoverable", trials: 1, owners: 1, links: 1 });
		expect(row.member_number).toBeGreaterThan(0);
		expect(row.twitch_created_at.toISOString()).toBe("2012-04-15T13:45:00.000Z");
		return row;
	}

	it("creates all Clipify records through the real post-account hook on a fresh migration-built database", async () => {
		migrate();
		expect((await fixture.pool.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('clipify_twitch_creator_on_account_insert','clipify_twitch_creator_profile_sync')")).rows).toEqual([]);
		const id = randomUUID();
		probe(id);
		expect((await expectComplete(id)).member_number).toBe(1);
		const notices = await fixture.pool.query("SELECT count(*)::int AS count FROM notification_outbox WHERE dedupe_key LIKE 'benefit:%:granted' AND recipient=$1", [`${id}@example.invalid`]);
		expect(notices.rows[0].count).toBe(1);
	});

	it("removes old deployed auth triggers when the production migration command runs", async () => {
		await fixture.pool.query(`CREATE FUNCTION public.clipify_provision_twitch_creator() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'OLD_TRIGGER_RAN'; END $$;
			CREATE TRIGGER clipify_twitch_creator_on_account_insert AFTER INSERT ON auth.account FOR EACH ROW EXECUTE FUNCTION public.clipify_provision_twitch_creator();
			CREATE FUNCTION public.clipify_sync_twitch_creator_profile() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'OLD_PROFILE_TRIGGER_RAN'; END $$;
			CREATE TRIGGER clipify_twitch_creator_profile_sync AFTER UPDATE ON auth."user" FOR EACH ROW EXECUTE FUNCTION public.clipify_sync_twitch_creator_profile();`);
		const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
		const entry = journal.entries.find((entry: { tag: string }) => entry.tag === "0031_remove_auth_onboarding_triggers");
		// Recreate the production ordering: master migration 0031 lands before this
		// branch's later 0032 migration, so both are pending together.
		await fixture.pool.query("DELETE FROM drizzle.__drizzle_migrations WHERE created_at >= $1", [entry.when]);
		migrate();
		const id = randomUUID();
		probe(id);
		await expectComplete(id);
		probe(id, "profile");
	});

	it("rolls back all Clipify setup if the trial fails and completes on a subsequent sign-in", async () => {
		const id = randomUUID();
		await fixture.pool.query(`CREATE FUNCTION reject_signup_trial() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_TRIAL_FAILURE'; END $$;
			CREATE TRIGGER reject_signup_trial BEFORE INSERT ON entitlement_grants FOR EACH ROW EXECUTE FUNCTION reject_signup_trial();`);
		expect(() => probe(id)).toThrow();
		expect(await state(id)).toBeUndefined();
		expect((await fixture.pool.query("SELECT count(*)::int AS count FROM auth.account WHERE account_id=$1", [id])).rows[0].count).toBe(1);
		expect((await fixture.pool.query("SELECT count(*)::int AS count FROM creator_accounts")).rows[0].count).toBe(0);
		expect((await fixture.pool.query("SELECT count(*)::int AS count FROM member_number_allocator")).rows[0].count).toBe(0);
		await fixture.pool.query("DROP TRIGGER reject_signup_trial ON entitlement_grants");
		probe(id, "retry");
		await expectComplete(id);
	});

	it("does not partially provision a creator when the Twitch profile is invalid", async () => {
		const id = randomUUID();
		expect(() => probe(id, "wrong-profile")).toThrow();
		expect(await state(id)).toBeUndefined();
		probe(id, "retry");
		await expectComplete(id);
	});

	it("preserves settings, member numbers and expired trials across concurrent retries", async () => {
		const id = randomUUID();
		probe(id);
		const before = await state(id);
		await fixture.pool.query('UPDATE "userSettings" SET prefix=$2, marketing_opt_in=false WHERE id=$1', [id, "custom!"]);
		await fixture.pool.query("UPDATE entitlement_grants SET starts_at=now()-interval '20 days',ends_at=now()-interval '13 days' WHERE user_id=$1", [id]);
		probe(id, "initialize");
		const after = await state(id);
		expect(after).toMatchObject({ member_number: before.member_number, prefix: "custom!", marketing_opt_in: false, owners: 1, links: 1, trials: 1 });
		expect((await fixture.pool.query("SELECT ends_at < now() AS expired FROM entitlement_grants WHERE user_id=$1", [id])).rows[0].expired).toBe(true);
	});

	it("preserves a pre-existing paid, manually disabled creator when Twitch is linked", async () => {
		const id = randomUUID();
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan,member_number,disabled,disable_type) VALUES($1,$2,'Existing','','user','pro',500,true,'manual')", [id, `${id}@example.invalid`]);
		await fixture.pool.query('INSERT INTO "userSettings"(id,prefix,marketing_opt_in) VALUES($1,$2,false)', [id, "keep!"]);
		probe(id);
		expect(await state(id)).toMatchObject({ plan: "pro", disabled: true, disable_type: "manual", member_number: 500, prefix: "keep!", marketing_opt_in: false, trials: 0, owners: 1 });
		await fixture.pool.query("UPDATE auth.member SET role='operations' WHERE organization_id=$1", [`creator:${id}`]);
		probe(id, "initialize");
		expect((await fixture.pool.query("SELECT role FROM auth.member WHERE organization_id=$1", [`creator:${id}`])).rows[0].role).toBe("operations");
	});

	it("synchronizes verified profiles through Better Auth's user-update hook", async () => {
		const id = randomUUID();
		probe(id);
		probe(id, "profile");
		const result = await fixture.pool.query("SELECT u.username,u.email,o.name FROM users u JOIN creator_accounts a ON a.creator_id=u.id JOIN auth.organization o ON o.id=a.organization_id WHERE u.id=$1", [id]);
		expect(result.rows[0]).toEqual({ username: "Updated Creator", email: `updated-${id}@example.invalid`, name: "Updated Creator" });
	});

	it("rejects unverified identities without creating Clipify records", async () => {
		const id = randomUUID();
		expect(() => probe(id, "unverified")).toThrow();
		expect(await state(id)).toBeUndefined();
	});

	it("does not initialize a creator for a non-Twitch auth account", async () => {
		const id = randomUUID();
		probe(id, "non-twitch");
		expect(await state(id)).toBeUndefined();
	});

	it("allocates unique member numbers for simultaneous real Better Auth signups", async () => {
		const id = randomUUID();
		const result = probe(id, "concurrent");
		const rows = await Promise.all(result.creators.map((creatorId: string) => expectComplete(creatorId)));
		expect(new Set(rows.map((row) => row.member_number)).size).toBe(4);
	});

	it("rejects conflicting creator ownership and rolls back new Clipify rows", async () => {
		const id = randomUUID();
		const result = probe(id);
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,'other@example.invalid','Other','','user','free')", [`other-${id}`]);
		await fixture.pool.query("UPDATE creator_identity_links SET creator_id=$2 WHERE auth_user_id=$1", [result.authUserId, `other-${id}`]);
		expect(() => probe(id, "retry")).toThrow();
		expect((await state(id)).trials).toBe(1);
	});
});
