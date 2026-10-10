import { sql } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
/** Other access must survive the ending source; runner access is never inferred from Pro. */
export async function hasContinuingPro(userId: string, at: Date, excludedGrantId: string | null = null, client: QueryClient = db): Promise<boolean> {
	const result = await client.execute(sql`
 SELECT EXISTS(SELECT 1 FROM users WHERE id=${userId} AND plan='pro' AND NOT EXISTS(
 SELECT 1 FROM billing_subscriptions subscriptions JOIN billing_subscription_items items ON items.subscription_id=subscriptions.id WHERE subscriptions.user_id=${userId} AND items.product_key='pro'))
 OR EXISTS(SELECT 1 FROM billing_subscriptions subscriptions JOIN billing_subscription_items items ON items.subscription_id=subscriptions.id
 WHERE subscriptions.user_id=${userId} AND items.product_key='pro' AND subscriptions.status IN ('active','trialing','past_due')
 AND (NOT subscriptions.cancel_at_period_end OR subscriptions.current_period_end>${at}))
 OR EXISTS(SELECT 1 FROM entitlement_grants WHERE (user_id=${userId} OR user_id IS NULL)
 AND entitlement='pro_access' AND revoked_at IS NULL AND starts_at<=${at}
 AND (${excludedGrantId}::uuid IS NULL OR id<>${excludedGrantId}::uuid)
 AND (ends_at IS NULL OR ends_at + CASE WHEN source='partner' THEN interval '7 days' ELSE interval '0 days' END > ${at}))
 OR EXISTS(SELECT 1 FROM agency_license_allocations WHERE creator_id=${userId}
 AND product='creator_pro' AND status IN ('active','removal_scheduled')
 AND effective_at<=${at} AND (ends_at IS NULL OR ends_at>${at})) AS active
 `);
	return result.rows[0]?.active === true;
}

export async function hasContinuingRunner(userId: string, at: Date, excludedGrantId: string | null = null, client: QueryClient = db): Promise<boolean> {
	const result = await client.execute(sql`SELECT
 EXISTS(SELECT 1 FROM billing_subscriptions subscriptions JOIN billing_subscription_items items ON items.subscription_id=subscriptions.id
 WHERE subscriptions.user_id=${userId} AND items.product_key='runner_self_hosted' AND subscriptions.status IN ('active','trialing','past_due')
 AND (NOT subscriptions.cancel_at_period_end OR subscriptions.current_period_end>${at}))
 OR EXISTS(SELECT 1 FROM entitlement_grants WHERE (user_id=${userId} OR user_id IS NULL)
 AND entitlement='runner_access' AND revoked_at IS NULL AND starts_at<=${at}
 AND (${excludedGrantId}::uuid IS NULL OR id<>${excludedGrantId}::uuid) AND (ends_at IS NULL OR ends_at>${at}))
 OR EXISTS(SELECT 1 FROM agency_license_allocations WHERE creator_id=${userId}
 AND product='runner' AND status IN ('active','removal_scheduled') AND effective_at<=${at} AND (ends_at IS NULL OR ends_at>${at})) AS active`);
	return result.rows[0]?.active === true;
}
export function hasContinuingBenefit(benefit: "pro" | "runner", userId: string, at: Date, excludedGrantId: string | null = null) {
	return benefit === "runner" ? hasContinuingRunner(userId, at, excludedGrantId) : hasContinuingPro(userId, at, excludedGrantId);
}
