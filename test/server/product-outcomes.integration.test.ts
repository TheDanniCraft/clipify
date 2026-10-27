/** @jest-environment node */
import { readFileSync } from "node:fs";
import { createMcpPostgresFixture } from "../support/mcp/postgres";
import { recordProductOutcome } from "@/server/product-outcomes";

jest.setTimeout(60_000);
it("stores one outcome under concurrent retries, separates repeat days, and rolls back failed journeys", async () => {
	const fixture = await createMcpPostgresFixture();
	const previousBase = process.env.NEXT_PUBLIC_BASE_URL;
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	try {
		const client = fixture.db;
		await recordProductOutcome({ outcome: "creator_created", creatorId: "fixture-creator", key: "signup", occurredAt: new Date(Date.now() - 3 * 86400000) }, client);
		const event = { outcome: "payment_verified" as const, creatorId: "fixture-creator", key: "invoice-1", metadata: { amountMinor: 200, currency: "eur" } };
		await Promise.all(Array.from({ length: 8 }, () => recordProductOutcome(event, client)));
		await recordProductOutcome({ outcome: "first_playback", creatorId: "fixture-creator", key: "first", occurredAt: new Date(Date.now() - 2 * 86400000) }, client);
		for (const offset of [2, 2, 1]) {
			const occurredAt = new Date(Date.now() - offset * 86400000);
			await recordProductOutcome({ outcome: "playback_day", creatorId: "fixture-creator", key: occurredAt.toISOString().slice(0, 10), occurredAt }, client);
		}
		await expect(
			client.transaction(async (tx) => {
				await recordProductOutcome({ outcome: "creator_created", creatorId: "failed-creator", key: "signup" }, tx);
				throw new Error("rollback fixture");
			}),
		).rejects.toThrow("rollback fixture");
		const result = await fixture.pool.query("SELECT action,count(*)::int AS count FROM audit_events WHERE action LIKE 'product:%' GROUP BY action ORDER BY action");
		expect(result.rows).toEqual([
			{ action: "product:creator_created", count: 1 },
			{ action: "product:first_playback", count: 1 },
			{ action: "product:payment_verified", count: 1 },
			{ action: "product:playback_day", count: 2 },
		]);
		const reports = (await fixture.pool.query(readFileSync("docs/marketing-outcome-report.sql", "utf8"))) as unknown as { rows: Record<string, unknown>[] }[];
		expect(reports[0].rows[0]).toMatchObject({ new_creators: "1", first_playback: "1", playback_on_multiple_utc_days: "1", creators_with_verified_payment: "1" });
		expect(reports[1].rows[0]).toMatchObject({ currency: "eur", paid_invoices: "1", amount_received_minor_units: "200" });
	} finally {
		if (previousBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
		else process.env.NEXT_PUBLIC_BASE_URL = previousBase;
		await fixture.close();
	}
});

it("removes only the deleted creator's product records during the existing account purge", async () => {
	const fixture = await createMcpPostgresFixture();
	try {
		const { purgeDueDatabaseAccounts } = await import("@/server/account-lifecycle/database-purge");
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('fixture-org','Fixture','fixture-org',now())");
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('deleted-creator','fixture@example.invalid','fixture','','user','free')");
		await fixture.pool.query("INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('deleted-creator','fixture-org','suspended')");
		await fixture.pool.query("INSERT INTO account_deletion_requests(organization_id,choice,status,suspension_at,suspended_at,purge_eligible_at) VALUES('fixture-org','immediate','suspended',now()-interval '40 days',now()-interval '40 days',now()-interval '1 day')");
		await recordProductOutcome({ outcome: "first_playback", creatorId: "deleted-creator", key: "first" }, fixture.db);
		await recordProductOutcome({ outcome: "first_playback", creatorId: "other-creator", key: "first" }, fixture.db);
		expect(await purgeDueDatabaseAccounts({}, fixture.db)).toEqual({ purged: 1 });
		expect((await fixture.pool.query("SELECT target_id FROM audit_events WHERE action LIKE 'product:%'")).rows).toEqual([{ target_id: "other-creator" }]);
	} finally {
		await fixture.close();
	}
});

it("reports mature retention windows, activation delay and refunds independently of gross receipts", async () => {
	const fixture = await createMcpPostgresFixture();
	const previous = process.env.NEXT_PUBLIC_BASE_URL;
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	const now = Date.now();
	const day = 86400000;
	try {
		for (const [id, age] of [
			["mature", 50],
			["young", 2],
			["no-return", 50],
		] as const) {
			await recordProductOutcome({ outcome: "creator_created", creatorId: id, key: "signup", occurredAt: new Date(now - age * day - 60000) }, fixture.db);
			await recordProductOutcome({ outcome: "first_playback", creatorId: id, key: "first", occurredAt: new Date(now - age * day) }, fixture.db);
		}
		for (const age of [43, 20]) await recordProductOutcome({ outcome: "playback_day", creatorId: "mature", key: String(age), occurredAt: new Date(now - age * day) }, fixture.db);
		// A preview return must not rescue an otherwise inactive production cohort.
		process.env.NEXT_PUBLIC_BASE_URL = "https://preview.invalid";
		await recordProductOutcome({ outcome: "playback_day", creatorId: "no-return", key: "preview", occurredAt: new Date(now - 43 * day) }, fixture.db);
		process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
		for (let i = 0; i < 2; i++) await recordProductOutcome({ outcome: "refund_succeeded", creatorId: "mature", key: "re_1", metadata: { amountMinor: 50, currency: "eur" } }, fixture.db);
		await recordProductOutcome({ outcome: "payment_failed", creatorId: "mature", key: "evt_fail", metadata: { currency: "eur" } }, fixture.db);
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES('guardrail','guardrail@example.invalid','guardrail','','user','free')");
		await fixture.pool.query("INSERT INTO billing_subscriptions(id,user_id,stripe_customer_id,status,cancel_at_period_end) VALUES('active','guardrail','cus_guardrail','active',true),('unpaid','guardrail','cus_guardrail','past_due',false),('canceled','guardrail','cus_guardrail','canceled',false)");
		const reports = (await fixture.pool.query(readFileSync("docs/marketing-outcome-report.sql", "utf8"))) as unknown as { rows: Record<string, unknown>[] }[];
		expect(reports[2].rows[0]).toMatchObject({ activated_creators: "3", median_seconds_to_first_playback: 60, d7_mature_creators: "2", d7_returned_creators: "1", d30_mature_creators: "2", d30_returned_creators: "1" });
		expect(reports[1].rows).toEqual([]);
		expect(reports[3].rows[0]).toMatchObject({ creators_canceling_at_period_end: "1", creators_with_payment_issues: "1", creators_with_canceled_subscriptions: "1" });
		expect(reports[4].rows).toEqual(expect.arrayContaining([expect.objectContaining({ action: "product:refund_succeeded", recorded_events: "1", refunded_minor_units: "50" }), expect.objectContaining({ action: "product:payment_failed", recorded_events: "1", refunded_minor_units: null })]));
	} finally {
		if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
		else process.env.NEXT_PUBLIC_BASE_URL = previous;
		await fixture.close();
	}
});
