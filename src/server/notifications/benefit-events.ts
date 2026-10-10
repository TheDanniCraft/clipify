import { EXPIRY_REMINDER_DAYS, DAY_MS } from "./reminder-schedule";
import { eq } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { notificationOutboxTable, usersTable } from "@/db/schema";
import type { BenefitEmail } from "./templates/benefits";

type GrantEmailInput = { id: string; userId: string | null; entitlement: string; source: string; reason: string | null; startsAt: Date; endsAt: Date | null };
type GrantNotice = { payload: BenefitEmail; at: Date };
function grantPayload(grant: GrantEmailInput): BenefitEmail {
	const partner = grant.source === "partner" && grant.entitlement === "pro_access";
	const trial = grant.source === "reverse_trial";
	const payload: BenefitEmail = { type: "benefit", benefit: grant.entitlement === "runner_access" ? "runner" : "pro", event: "granted", partner, complimentary: grant.source !== "managed_contract", trial, startsAt: grant.startsAt.toISOString(), endsAt: grant.endsAt?.toISOString() ?? null, reason: trial ? null : grant.reason };
	return payload;
}
function countdownNotices(payload: BenefitEmail, boundary: Date, after: Date, prefix: "trial" | "access" | "partner-ending" | "partner", offset = 0): GrantNotice[] {
	return EXPIRY_REMINDER_DAYS.flatMap((days) => {
		const at = new Date(boundary.getTime() + (offset - days) * DAY_MS);
		return at > after ? [{ payload: { ...payload, event: `${prefix}-${days}d` }, at }] : [];
	});
}
function expiryNotices(grant: GrantEmailInput, payload: BenefitEmail): GrantNotice[] {
	if (!grant.endsAt) return [];
	const notices: GrantNotice[] = payload.partner ? [...countdownNotices(payload, grant.endsAt, grant.startsAt, "partner-ending"), { payload: { ...payload, event: "partner-ended" }, at: grant.endsAt }, ...countdownNotices(payload, grant.endsAt, grant.endsAt, "partner", 7)] : countdownNotices(payload, grant.endsAt, grant.startsAt, payload.trial ? "trial" : "access");
	notices.push({ payload: { ...payload, event: "ended" }, at: new Date(grant.endsAt.getTime() + (payload.partner ? 7 * DAY_MS : 0)) });
	return notices;
}
function grantNoticeKey(grant: GrantEmailInput, notice: GrantNotice) {
	return `benefit:${grant.id}:${notice.payload.event}${notice.payload.event === "granted" ? "" : `:${grant.endsAt!.getTime()}`}`;
}
export async function queueGrantEmails(grant: GrantEmailInput, client: QueryClient = db, includeStart = true) {
	if (!grant.userId || grant.source === "billing" || !["pro_access", "runner_access"].includes(grant.entitlement)) return;
	const [user] = await client.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, grant.userId)).limit(1).execute();
	if (!user?.email) return;
	const payload = grantPayload(grant);
	const notices: GrantNotice[] = [...(includeStart ? [{ payload, at: grant.startsAt }] : []), ...expiryNotices(grant, payload)];
	for (const notice of notices)
		await client
			.insert(notificationOutboxTable)
			.values({ eventType: "entitlement", recipient: user.email, templateVersion: "benefit-v1", locale: "en", payload: { ...notice.payload, grantId: grant.id }, scheduledAt: notice.at, dedupeKey: grantNoticeKey(grant, notice) })
			.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
}

export async function queueCancellationEmail(input: { subscriptionId: string; userId: string; eventCreated: number; benefit: "pro" | "runner"; endsAt: Date | null }, client: QueryClient = db) {
	const [user] = await client.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, input.userId)).limit(1).execute();
	if (!user?.email) return;
	await client
		.insert(notificationOutboxTable)
		.values({ eventType: "billing", recipient: user.email, templateVersion: "benefit-v1", locale: "en", payload: { type: "benefit", event: "cancellation", subscriptionId: input.subscriptionId, benefit: input.benefit, endsAt: input.endsAt?.toISOString() ?? null }, scheduledAt: new Date(), dedupeKey: `cancellation:${input.subscriptionId}:${input.eventCreated}:${input.benefit}` })
		.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
}

/** Pick up recent explicit revocations without replaying historical account notices. */
export async function queueRevokedGrantEmails(now = new Date()) {
	const { sql } = await import("drizzle-orm");
	const result = await db.execute(sql`
 SELECT grants.id, grants.entitlement, grants.source, grants.revoked_at, users.email
 FROM entitlement_grants grants JOIN users ON users.id=grants.user_id
 WHERE grants.source <> 'billing' AND grants.entitlement IN ('pro_access', 'runner_access') AND users.email <> '' AND grants.revoked_at >= ${new Date(now.getTime() - 7 * 86400000)} AND grants.revoked_at <= ${now}
 AND NOT EXISTS (SELECT 1 FROM notification_outbox notices WHERE notices.dedupe_key = 'benefit:' || grants.id::text || ':revoked:' || floor(extract(epoch FROM grants.revoked_at)*1000)::text)
 ORDER BY grants.revoked_at,grants.id LIMIT 100
 `);
	for (const row of result.rows as Array<{ id: string; entitlement: string; source: string; email: string | null; revoked_at: Date }>) {
		if (!row.email) continue;
		await db
			.insert(notificationOutboxTable)
			.values({ eventType: "entitlement", recipient: row.email, templateVersion: "benefit-v1", locale: "en", payload: { type: "benefit", benefit: row.entitlement === "runner_access" ? "runner" : "pro", event: "revoked", partner: row.source === "partner" && row.entitlement === "pro_access", grantId: row.id }, scheduledAt: now, dedupeKey: `benefit:${row.id}:revoked:${new Date(row.revoked_at).getTime()}` })
			.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
	}
}

/** Existing time-limited grants get reminders without replaying their original grant email. */
export async function queueExistingGrantReminders(now = new Date()) {
	const { sql } = await import("drizzle-orm");
	const result = await db.execute(sql`
 SELECT grants.* FROM entitlement_grants grants JOIN users ON users.id=grants.user_id
 WHERE grants.source <> 'billing' AND grants.entitlement IN ('pro_access', 'runner_access') AND users.email <> '' AND grants.user_id IS NOT NULL AND grants.revoked_at IS NULL AND grants.ends_at + CASE WHEN grants.source='partner' AND grants.entitlement='pro_access' THEN interval '7 days' ELSE interval '0 days' END > ${now}
 AND NOT EXISTS (SELECT 1 FROM notification_outbox notices WHERE notices.dedupe_key = 'benefit:' || grants.id::text || ':ended:' || floor(extract(epoch FROM grants.ends_at)*1000)::text)
 ORDER BY grants.ends_at, grants.id LIMIT 100
 `);
	for (const row of result.rows as Array<{ id: string; user_id: string; entitlement: string; source: string; reason: string | null; starts_at: Date; ends_at: Date }>) await db.transaction(async (tx) => queueGrantEmails({ id: row.id, userId: row.user_id, entitlement: row.entitlement, source: row.source, reason: row.reason, startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }, tx, false));
}

export async function queueGrantRevocation(grant: { id: string; userId: string | null; entitlement: string; source?: string; revokedAt: Date | null }, client: QueryClient = db) {
	if (!grant.userId || !grant.revokedAt) return;
	const [user] = await client.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, grant.userId)).limit(1).execute();
	if (!user?.email) return;
	await client
		.insert(notificationOutboxTable)
		.values({ eventType: "entitlement", recipient: user.email, templateVersion: "benefit-v1", locale: "en", payload: { type: "benefit", benefit: grant.entitlement === "runner_access" ? "runner" : "pro", event: "revoked", partner: grant.source === "partner" && grant.entitlement === "pro_access", grantId: grant.id }, scheduledAt: new Date(), dedupeKey: `benefit:${grant.id}:revoked:${grant.revokedAt.getTime()}` })
		.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
}

/** Stripe-synced cancellations; the delivery check revalidates renewal and access. */
export async function queueSubscriptionCancellationReminders(input: { subscriptionId: string; userId: string; endsAt: Date; ended?: boolean; benefit?: "pro" | "runner" }, client: QueryClient = db) {
	const [user] = await client.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, input.userId)).limit(1).execute();
	if (!user?.email) return;
	const benefit = input.benefit ?? "pro";
	for (const days of input.ended ? [0] : EXPIRY_REMINDER_DAYS) {
		const scheduledAt = input.ended ? new Date() : new Date(input.endsAt.getTime() - days * DAY_MS);
		if (!input.ended && scheduledAt <= new Date()) continue;
		await client
			.insert(notificationOutboxTable)
			.values({
				eventType: "billing",
				recipient: user.email,
				templateVersion: "benefit-v1",
				locale: "en",
				payload: { type: "benefit", event: `cancellation-${days}d`, benefit, subscriptionId: input.subscriptionId, endsAt: input.endsAt.toISOString() },
				scheduledAt,
				dedupeKey: `${benefit}-cancellation:${input.subscriptionId}:${input.endsAt.getTime()}:${days}d`,
			})
			.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
	}
}
export async function queueExistingSubscriptionCancellationReminders(now = new Date()) {
	const { sql } = await import("drizzle-orm");
	const result = await db.execute(sql`SELECT subscriptions.id, subscriptions.user_id, subscriptions.current_period_end,
 CASE WHEN items.product_key='runner_self_hosted' THEN 'runner' ELSE 'pro' END AS benefit
 FROM billing_subscriptions subscriptions JOIN billing_subscription_items items ON items.subscription_id=subscriptions.id
 WHERE subscriptions.cancel_at_period_end AND subscriptions.status IN ('active','trialing','past_due')
 AND subscriptions.current_period_end > ${now} AND items.product_key IN ('pro','runner_self_hosted')
 AND NOT EXISTS (SELECT 1 FROM notification_outbox notices WHERE notices.dedupe_key=(CASE WHEN items.product_key='runner_self_hosted' THEN 'runner' ELSE 'pro' END)||'-cancellation:'||subscriptions.id||':'||floor(extract(epoch FROM subscriptions.current_period_end)*1000)::text||':1d')
 ORDER BY subscriptions.current_period_end, subscriptions.id LIMIT 100`);
	for (const row of result.rows as Array<{ id: string; user_id: string; current_period_end: Date; benefit: "pro" | "runner" }>) await queueSubscriptionCancellationReminders({ subscriptionId: row.id, userId: row.user_id, endsAt: new Date(row.current_period_end), benefit: row.benefit });
}
