/** Read-only production report. Run with injected DATABASE_URL; no repair mode. */
import { Pool } from "pg";

async function main() {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000, statement_timeout: 30_000 });
	const client = await pool.connect();
	try {
		await client.query("BEGIN READ ONLY");
		const result = await client.query(
			`
		 SELECT u.id, u.username, u.created_at, u.plan, u.disabled, u.member_number,
		  u.twitch_created_at, s.id IS NULL AS missing_settings,
		  s.marketing_opt_in, s.marketing_opt_in_at, s.marketing_opt_in_source,
		  s.usesend_product_updates_contact_id,
		  EXISTS (SELECT 1 FROM billing_subscriptions b WHERE b.user_id=u.id
		   AND b.status IN ('active','trialing','past_due','incomplete')) AS has_open_billing_subscription,
		  EXISTS (SELECT 1 FROM entitlement_grants g WHERE g.user_id=u.id AND g.source='reverse_trial') AS has_trial_history,
		  EXISTS (SELECT 1 FROM entitlement_grants g WHERE (g.user_id=u.id OR g.user_id IS NULL)
		   AND g.entitlement='pro_access' AND g.revoked_at IS NULL AND g.starts_at<=now()
		   AND (g.ends_at IS NULL OR g.ends_at + CASE WHEN g.source='partner' THEN interval '7 days' ELSE interval '0 days' END>now())) AS has_active_pro_grant,
		  EXISTS (SELECT 1 FROM agency_license_allocations a WHERE a.creator_id=u.id
		   AND a.product='creator_pro' AND a.status IN ('active','removal_scheduled')
		   AND a.effective_at<=now() AND (a.ends_at IS NULL OR a.ends_at>now())) AS has_agency_pro
		 FROM users u LEFT JOIN "userSettings" s ON s.id=u.id
		 WHERE u.created_at >= $1 AND u.created_at < $2
		 ORDER BY u.created_at,u.id`,
			[process.argv[2] ?? "2026-10-02T00:00:00Z", process.argv[3] ?? "2026-10-21T00:00:00Z"],
		);
		const accounts = result.rows.map((row) => ({ ...row, missing_member_number: row.member_number == null, needs_twitch_verification: new Date(row.twitch_created_at).toISOString() === "2016-05-01T00:00:00.000Z", trial_candidate: row.plan === "free" && !row.disabled && !row.has_open_billing_subscription && !row.has_trial_history && !row.has_active_pro_grant && !row.has_agency_pro }));
		process.stdout.write(JSON.stringify({ mode: "dry-run", generatedAt: new Date().toISOString(), accounts, counts: { accounts: accounts.length, missingMembership: accounts.filter((a) => a.missing_member_number).length, missingSettings: accounts.filter((a) => a.missing_settings).length, trialCandidates: accounts.filter((a) => a.trial_candidate).length, twitchVerification: accounts.filter((a) => a.needs_twitch_verification).length } }, null, 2) + "\n");
		await client.query("ROLLBACK");
	} finally {
		client.release();
		await pool.end();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
