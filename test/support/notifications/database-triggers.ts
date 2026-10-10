import { Entitlement, EntitlementGrantSource, Role, Plan } from "@types";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createMcpPostgresFixture } from "../mcp/postgres";
import { usersTable, entitlementGrantsTable, userBadgesTable, notificationOutboxTable } from "@/db/schema";
import { queueGrantEmails, queueGrantRevocation } from "@/server/notifications/benefit-events";
import { queueBadgeEmail } from "@/server/notifications/badge-events";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
const startsAt = new Date("2040-01-01T12:00:00Z"),
	endsAt = new Date("2040-01-08T12:00:00Z");
before(async () => {
	fixture = await createMcpPostgresFixture();
	const sql = await readFile("drizzle/0026_notification_event_triggers.sql", "utf8");
	for (const statement of sql.split("--> statement-breakpoint")) await fixture.pool.query(statement);
});
after(async () => {
	await fixture?.close();
});
beforeEach(async () => {
	await fixture.pool.query("TRUNCATE notification_outbox, users CASCADE");
	await fixture.db.insert(usersTable).values({ id: "notification-user", username: "Alex", email: "alex@example.test", avatar: "", role: Role.User, plan: Plan.Free });
	await fixture.db.insert(usersTable).values({ id: "other-user", username: "Other", email: "other@example.test", avatar: "", role: Role.User, plan: Plan.Free });
});
async function grant(source: EntitlementGrantSource = EntitlementGrantSource.Support) {
	const [row] = await fixture.db.insert(entitlementGrantsTable).values({ userId: "notification-user", entitlement: Entitlement.ProAccess, source, reason: "Thanks for your help", startsAt, endsAt }).returning();
	return row;
}
async function notices() {
	return fixture.db.select().from(notificationOutboxTable);
}
test("application and database fallback share one grant event and one expiry event", async () => {
	const row = await grant();
	await queueGrantEmails(row, fixture.db);
	const rows = await notices();
	assert.equal(rows.length, 4);
	assert.ok(rows.every((row) => row.recipient === "alex@example.test"));
	assert.equal(rows.filter((row) => row.payload.event === "granted").length, 1);
});
test("direct SQL reverse trial creates its start, countdowns and expiry", async () => {
	await grant(EntitlementGrantSource.ReverseTrial);
	assert.deepEqual((await notices()).map((row) => row.payload.event).sort(), ["ended", "granted", "trial-1d", "trial-3d"]);
});
test("noop and reason-only updates produce no notification; manual extension does", async () => {
	const row = await grant();
	await fixture.db.update(entitlementGrantsTable).set({ updatedAt: new Date(), reason: "Internal note corrected" }).where(eq(entitlementGrantsTable.id, row.id));
	assert.equal((await notices()).length, 4);
	await fixture.db
		.update(entitlementGrantsTable)
		.set({ endsAt: new Date("2040-01-15T12:00:00Z") })
		.where(eq(entitlementGrantsTable.id, row.id));
	const rows = await notices();
	assert.equal(rows.filter((row) => row.payload.event === "updated").length, 1);
	assert.equal(rows.filter((row) => row.payload.event === "ended").length, 2);
});
test("manual revocation and application queuing cannot double-send", async () => {
	const row = await grant();
	const [updated] = await fixture.db
		.update(entitlementGrantsTable)
		.set({ revokedAt: new Date("2040-01-02T12:00:00Z") })
		.where(eq(entitlementGrantsTable.id, row.id))
		.returning();
	await queueGrantRevocation(updated, fixture.db);
	assert.equal((await notices()).filter((row) => row.payload.event === "revoked").length, 1);
});
test("rolled-back grants also roll back their notifications", async () => {
	await assert.rejects(
		fixture.db.transaction(async (tx) => {
			await tx.insert(entitlementGrantsTable).values({ userId: "notification-user", entitlement: Entitlement.RunnerAccess, source: EntitlementGrantSource.Support, startsAt, endsAt });
			throw new Error("rollback");
		}),
	);
	assert.equal((await notices()).length, 0);
});
test("billing reconciliation and global grants do not generate free-gift notifications", async () => {
	await grant(EntitlementGrantSource.Billing);
	await fixture.db.insert(entitlementGrantsTable).values({ userId: null, entitlement: Entitlement.ProAccess, source: EntitlementGrantSource.Promo, startsAt, endsAt });
	assert.equal((await notices()).length, 0);
});
test("manual badge award and removal use the same keys as application notifications", async () => {
	const [award] = await fixture.db.insert(userBadgesTable).values({ userId: "notification-user", badge: "contributor", awardedAt: startsAt }).returning();
	await queueBadgeEmail(award, "awarded", fixture.db);
	assert.equal((await notices()).length, 1);
	await fixture.db.delete(userBadgesTable).where(eq(userBadgesTable.userId, "notification-user"));
	await queueBadgeEmail(award, "removed", fixture.db);
	assert.equal((await notices()).length, 2);
});
test("cascading account deletion produces no badge-removal message", async () => {
	await fixture.db.insert(userBadgesTable).values({ userId: "notification-user", badge: "beta-tester" });
	await fixture.db.delete(usersTable).where(eq(usersTable.id, "notification-user"));
	assert.equal((await notices()).filter((row) => row.payload.event === "removed").length, 0);
});

test("account status fallback ignores profile edits and deduplicates the admin event", async () => {
	const { queueAccountAccessEmail } = await import("@/server/notifications/account-access-events");
	await fixture.db.update(usersTable).set({ username: "New Alex" }).where(eq(usersTable.id, "notification-user"));
	assert.equal((await notices()).length, 0);
	const changedAt = new Date("2040-01-02T12:00:00Z");
	await fixture.db.update(usersTable).set({ disabled: true, disableType: "manual", disabledReason: "Policy", updatedAt: changedAt }).where(eq(usersTable.id, "notification-user"));
	await queueAccountAccessEmail({ userId: "notification-user", email: "alex@example.test", name: "New Alex", disabled: true, reason: "Policy", changedAt }, fixture.db);
	assert.equal((await notices()).length, 1);
	await fixture.db
		.update(usersTable)
		.set({ disabled: false, disableType: null, updatedAt: new Date("2040-01-03T12:00:00Z") })
		.where(eq(usersTable.id, "notification-user"));
	const rows = await notices();
	assert.equal(rows.length, 2);
	assert.equal(rows.find((row) => row.payload.disabled === false)?.payload.automatic, false);
});

test("expired account purge deletes only its creator and queues the final email once", async () => {
	const { organization, user, member } = await import("@/db/auth-schema");
	const { creatorAccountsTable, creatorIdentityLinksTable, accountDeletionRequestsTable } = await import("@/db/schema");
	const { purgeDueDatabaseAccounts } = await import("@/server/account-lifecycle/database-purge");
	await fixture.db.insert(user).values({ id: "shared-identity", name: "Alex", email: "verified@example.test" });
	await fixture.db.insert(organization).values([
		{ id: "delete-org", name: "Creator", slug: "delete-org", createdAt: startsAt },
		{ id: "keep-org", name: "Agency", slug: "keep-org", createdAt: startsAt },
	]);
	await fixture.db.insert(member).values({ id: "keep-member", organizationId: "keep-org", userId: "shared-identity", role: "owner", createdAt: startsAt });
	await fixture.db.insert(creatorIdentityLinksTable).values({ creatorId: "notification-user", authUserId: "shared-identity", source: "twitch_onboarding" });
	await fixture.db.insert(creatorAccountsTable).values({ organizationId: "delete-org", creatorId: "notification-user", status: "suspended" });
	await fixture.db.insert(accountDeletionRequestsTable).values({ organizationId: "delete-org", choice: "immediate", status: "suspended", suspensionAt: startsAt, suspendedAt: startsAt, purgeEligibleAt: endsAt });
	const client = fixture.db as unknown as Parameters<typeof purgeDueDatabaseAccounts>[1];
	assert.equal((await purgeDueDatabaseAccounts({ now: startsAt }, client)).purged, 0);
	await fixture.pool.query(`CREATE FUNCTION reject_final_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='account-deleted' THEN RAISE EXCEPTION 'fixture outbox failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_final_notice BEFORE INSERT ON notification_outbox FOR EACH ROW EXECUTE FUNCTION reject_final_notice();`);
	await assert.rejects(purgeDueDatabaseAccounts({ now: endsAt }, client));
	assert.equal((await fixture.db.select().from(usersTable).where(eq(usersTable.id, "notification-user"))).length, 1);
	assert.equal((await notices()).length, 0);
	await fixture.pool.query("DROP TRIGGER reject_final_notice ON notification_outbox; DROP FUNCTION reject_final_notice();");
	assert.equal((await purgeDueDatabaseAccounts({ now: endsAt }, client)).purged, 1);
	assert.equal((await purgeDueDatabaseAccounts({ now: endsAt }, client)).purged, 0);
	assert.equal((await fixture.db.select().from(usersTable).where(eq(usersTable.id, "notification-user"))).length, 0);
	assert.equal((await fixture.db.select().from(usersTable).where(eq(usersTable.id, "other-user"))).length, 1);
	assert.equal((await fixture.db.select().from(user).where(eq(user.id, "shared-identity"))).length, 1);
	const rows = await notices();
	assert.equal(rows.filter((row) => row.eventType === "account-deleted").length, 1);
	assert.equal(rows.find((row) => row.eventType === "account-deleted")?.recipient, "verified@example.test");
});

test("Partner expiry schedules badge ending, two grace reminders and Pro expiry with shared dedupe keys", async () => {
	const row = await grant(EntitlementGrantSource.Partner);
	await queueGrantEmails(row, fixture.db);
	const rows = await notices();
	assert.equal(rows.length, 7);
	assert.deepEqual(rows.map((row) => row.payload.event).sort(), ["ended", "granted", "partner-1d", "partner-3d", "partner-ended", "partner-ending-1d", "partner-ending-3d"]);
	assert.equal(rows.find((row) => row.payload.event === "ended")!.scheduledAt.getTime(), endsAt.getTime() + 7 * 86400000);
	assert.equal(rows.find((row) => row.payload.event === "partner-ended")!.scheduledAt.getTime(), endsAt.getTime());
	await fixture.db.update(entitlementGrantsTable).set({ endsAt: null }).where(eq(entitlementGrantsTable.id, row.id));
	assert.equal((await notices()).filter((row) => row.payload.event === "updated").length, 1);
	await fixture.db.update(entitlementGrantsTable).set({ endsAt }).where(eq(entitlementGrantsTable.id, row.id));
	assert.equal((await notices()).filter((row) => row.payload.event === "partner-scheduled").length, 1);
});
test("actual entitlement queries retain Partner Pro for exactly seven days, never runner access", async () => {
	const { resolveUserEntitlements, getActiveEntitlementGrant } = await import("@lib/entitlements");
	const now = new Date();
	const [partner] = await fixture.db
		.insert(entitlementGrantsTable)
		.values({ userId: "notification-user", entitlement: Entitlement.ProAccess, source: EntitlementGrantSource.Partner, startsAt: new Date(now.getTime() - 20 * 86400000), endsAt: new Date(now.getTime() - 86400000) })
		.returning();
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Free }, fixture.db)).proAccess, true);
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Free }, fixture.db)).runnerAccess, false);
	assert.ok(await getActiveEntitlementGrant("notification-user", Entitlement.ProAccess, new Date(partner.endsAt!.getTime() + 7 * 86400000 - 1), fixture.db));
	assert.equal(await getActiveEntitlementGrant("notification-user", Entitlement.ProAccess, new Date(partner.endsAt!.getTime() + 7 * 86400000), fixture.db), null);
	await fixture.db
		.update(entitlementGrantsTable)
		.set({ endsAt: new Date(now.getTime() - 8 * 86400000) })
		.where(eq(entitlementGrantsTable.id, partner.id));
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Pro }, fixture.db)).proAccess, true);
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Free }, fixture.db)).proAccess, false);
});
test("paid Pro welcome and renewal deduplicate invoice replay and transactions", async () => {
	const { queueProPaymentEmail } = await import("@/server/notifications/pro-events");
	const input = { userId: "notification-user", subscriptionId: "sub-one", invoiceId: "invoice-first", amountPaid: 100, billingReason: "subscription_create" };
	await fixture.db.update(usersTable).set({ plan: Plan.Pro }).where(eq(usersTable.id, input.userId));
	await fixture.db.transaction((tx) => queueProPaymentEmail(input, tx));
	await fixture.db.transaction((tx) => queueProPaymentEmail(input, tx));
	assert.equal((await notices()).length, 1);
	const renewed = { ...input, invoiceId: "invoice-renewal", billingReason: "subscription_cycle" };
	await fixture.db.transaction((tx) => queueProPaymentEmail(renewed, tx));
	await fixture.db.transaction((tx) => queueProPaymentEmail(renewed, tx));
	assert.deepEqual((await notices()).map((row) => row.payload.event).sort(), ["first-pro", "renewal"]);
	await fixture.db.transaction((tx) => queueProPaymentEmail({ ...renewed, invoiceId: "zero", amountPaid: 0 }, tx));
	await fixture.db.transaction((tx) => queueProPaymentEmail({ ...renewed, invoiceId: "proration", billingReason: "subscription_update" }, tx));
	assert.equal((await notices()).length, 2);
});
test("first paid cycle without prior welcome sends one thank-you even when replayed", async () => {
	const { queueProPaymentEmail } = await import("@/server/notifications/pro-events");
	const input = { userId: "notification-user", subscriptionId: "sub-one", invoiceId: "invoice-first-cycle", amountPaid: 100, billingReason: "subscription_cycle" };
	await fixture.db.transaction((tx) => queueProPaymentEmail(input, tx));
	await fixture.db.transaction((tx) => queueProPaymentEmail(input, tx));
	assert.equal((await notices()).length, 1);
	assert.equal((await notices())[0].payload.event, "first-pro");
});
test("notification access checks preserve another Partner, paid plan or agency source", async () => {
	const { hasContinuingPro } = await import("@/server/notifications/access-context");
	const row = await grant(EntitlementGrantSource.ReverseTrial);
	assert.equal(await hasContinuingPro("notification-user", endsAt, row.id, fixture.db), false);
	await fixture.db.update(usersTable).set({ plan: Plan.Pro }).where(eq(usersTable.id, "notification-user"));
	assert.equal(await hasContinuingPro("notification-user", endsAt, row.id, fixture.db), true);
	await fixture.db.update(usersTable).set({ plan: Plan.Free }).where(eq(usersTable.id, "notification-user"));
	const partner = await grant(EntitlementGrantSource.Partner);
	assert.equal(await hasContinuingPro("notification-user", endsAt, row.id, fixture.db), true);
	await fixture.db.update(entitlementGrantsTable).set({ revokedAt: startsAt }).where(eq(entitlementGrantsTable.id, partner.id));
	assert.equal(await hasContinuingPro("notification-user", endsAt, row.id, fixture.db), false);
});

test("Stripe ending cannot override Partner or agency Pro, and Partner ending cannot override paid Pro", async () => {
	const { hasContinuingPro } = await import("@/server/notifications/access-context");
	const { resolveUserEntitlements } = await import("@lib/entitlements");
	const { billingSubscriptionsTable, billingSubscriptionItemsTable, agencyCreatorLinksTable, agencyLicenseAllocationsTable } = await import("@/db/schema");
	const { organization } = await import("@/db/auth-schema");
	const now = new Date();
	await fixture.db.insert(billingSubscriptionsTable).values({ id: "sub-cross-source", userId: "notification-user", stripeCustomerId: "customer", status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000) });
	await fixture.db.insert(billingSubscriptionItemsTable).values({ id: "item-cross-source", subscriptionId: "sub-cross-source", productKey: "pro" as import("@types").BillingProduct, stripeProductId: "product", stripePriceId: "price", currency: "eur", billingInterval: "month" });
	const [partner] = await fixture.db
		.insert(entitlementGrantsTable)
		.values({ userId: "notification-user", entitlement: Entitlement.ProAccess, source: EntitlementGrantSource.Partner, startsAt: new Date(now.getTime() - 20 * 86400000), endsAt: new Date(now.getTime() - 10 * 86400000) })
		.returning();
	await fixture.db.update(usersTable).set({ plan: Plan.Pro }).where(eq(usersTable.id, "notification-user"));
	assert.equal(await hasContinuingPro("notification-user", now, partner.id, fixture.db), true);
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Pro }, fixture.db)).proAccess, true);
	await fixture.db.update(billingSubscriptionsTable).set({ status: "unpaid" }).where(eq(billingSubscriptionsTable.id, "sub-cross-source"));
	await fixture.db.update(usersTable).set({ plan: Plan.Free }).where(eq(usersTable.id, "notification-user"));
	await fixture.db.update(entitlementGrantsTable).set({ endsAt: null }).where(eq(entitlementGrantsTable.id, partner.id));
	assert.equal(await hasContinuingPro("notification-user", now, null, fixture.db), true);
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Free }, fixture.db)).proAccess, true);
	await fixture.db.update(entitlementGrantsTable).set({ revokedAt: now }).where(eq(entitlementGrantsTable.id, partner.id));
	await fixture.db.insert(organization).values([
		{ id: "notice-agency", slug: "notice-agency", name: "Agency", createdAt: now },
		{ id: "notice-creator", slug: "notice-creator", name: "Creator", createdAt: now },
	]);
	const [link] = await fixture.db.insert(agencyCreatorLinksTable).values({ agencyOrganizationId: "notice-agency", creatorOrganizationId: "notice-creator" }).returning();
	await fixture.db.insert(agencyLicenseAllocationsTable).values({ linkId: link.id, creatorId: "notification-user", product: "creator_pro", status: "active", effectiveAt: now, sourceReference: "fixture" });
	assert.equal(await hasContinuingPro("notification-user", now, null, fixture.db), true);
	assert.equal((await resolveUserEntitlements({ id: "notification-user", plan: Plan.Free }, fixture.db)).proAccess, true);
});

test("successful invoice notifications roll back atomically", async () => {
	const { queueProPaymentEmail } = await import("@/server/notifications/pro-events");
	const { billingSubscriptionsTable, billingSubscriptionItemsTable } = await import("@/db/schema");
	await fixture.db.update(usersTable).set({ plan: Plan.Pro }).where(eq(usersTable.id, "notification-user"));
	await fixture.db.insert(billingSubscriptionsTable).values({ id: "sub-trial", userId: "notification-user", stripeCustomerId: "customer", status: "trialing" });
	await fixture.db.insert(billingSubscriptionItemsTable).values({ id: "item-trial", subscriptionId: "sub-trial", productKey: "pro" as import("@types").BillingProduct, stripeProductId: "product", stripePriceId: "price", currency: "eur", billingInterval: "month" });
	assert.equal((await notices()).length, 0);
	await assert.rejects(
		fixture.db.transaction(async (tx) => {
			await queueProPaymentEmail({ userId: "notification-user", subscriptionId: "sub-trial", invoiceId: "invoice-rollback", amountPaid: 100, billingReason: "subscription_create" }, tx);
			throw new Error("fixture payment transaction rollback");
		}),
	);
	assert.equal((await notices()).length, 0);
});

test("resubscribing sends a welcome back per new subscription without repeating the first thank-you", async () => {
	const { queueProPaymentEmail } = await import("@/server/notifications/pro-events");
	const input = { userId: "notification-user", subscriptionId: "sub-original", invoiceId: "first", amountPaid: 100, billingReason: "subscription_create" };
	await queueProPaymentEmail(input, fixture.db);
	for (const subscriptionId of ["sub-return", "sub-return-again"]) {
		const returned = { ...input, subscriptionId, invoiceId: subscriptionId + "-invoice" };
		await queueProPaymentEmail(returned, fixture.db);
		await queueProPaymentEmail(returned, fixture.db);
		await queueProPaymentEmail({ ...returned, invoiceId: subscriptionId + "-different-replay" }, fixture.db);
	}
	await queueProPaymentEmail(input, fixture.db);
	const rows = await notices();
	assert.equal(rows.filter((row) => row.payload.event === "first-pro").length, 1);
	assert.equal(rows.filter((row) => row.payload.event === "welcome-back").length, 2);
});

test("paid Pro cancellation reminders deduplicate snapshots and track changed Stripe end dates", async () => {
	const { queueSubscriptionCancellationReminders } = await import("@/server/notifications/benefit-events");
	const input = { userId: "notification-user", subscriptionId: "canceled-pro", endsAt };
	await queueSubscriptionCancellationReminders(input, fixture.db);
	await queueSubscriptionCancellationReminders(input, fixture.db);
	let rows = await notices();
	assert.equal(rows.length, 4);
	assert.deepEqual(rows.map((row) => row.payload.event).sort(), ["cancellation-1d", "cancellation-30d", "cancellation-3d", "cancellation-7d"]);
	await queueSubscriptionCancellationReminders({ ...input, endsAt: new Date(endsAt.getTime() + 86400000) }, fixture.db);
	rows = await notices();
	assert.equal(rows.length, 8);
	await queueSubscriptionCancellationReminders({ ...input, ended: true }, fixture.db);
	await queueSubscriptionCancellationReminders({ ...input, ended: true }, fixture.db);
	assert.equal((await notices()).filter((row) => row.payload.event === "cancellation-0d").length, 1);
});

test("long partnerships queue thirty, seven, three and one day warnings and seven-day Pro grace", async () => {
	const end = new Date("2040-03-01T12:00:00Z");
	const [partner] = await fixture.db.insert(entitlementGrantsTable).values({ userId: "notification-user", entitlement: Entitlement.ProAccess, source: EntitlementGrantSource.Partner, startsAt, endsAt: end }).returning();
	await queueGrantEmails(partner, fixture.db);
	const rows = await notices();
	for (const days of [30, 7, 3, 1]) {
		const matches = rows.filter((row) => row.payload.event === `partner-ending-${days}d`);
		assert.equal(matches.length, 1);
		assert.equal(matches[0].scheduledAt.getTime(), end.getTime() - days * 86400000);
	}
	assert.equal(rows.find((row) => row.payload.event === "partner-3d")!.scheduledAt.getTime(), end.getTime() + 4 * 86400000);
	assert.equal(rows.find((row) => row.payload.event === "ended")!.scheduledAt.getTime(), end.getTime() + 7 * 86400000);
});

test("long Pro and Runner awards and trials share all reminder keys between PostgreSQL and the app", async () => {
	for (const entitlement of [Entitlement.ProAccess, Entitlement.RunnerAccess])
		for (const source of [EntitlementGrantSource.Support, EntitlementGrantSource.ReverseTrial]) {
			await fixture.pool.query("TRUNCATE notification_outbox, entitlement_grants CASCADE");
			const [row] = await fixture.db
				.insert(entitlementGrantsTable)
				.values({ userId: "notification-user", entitlement, source, startsAt, endsAt: new Date("2040-03-01T12:00:00Z") })
				.returning();
			await queueGrantEmails(row, fixture.db);
			const rows = await notices();
			assert.equal(rows.length, 6);
			for (const days of [30, 7, 3, 1]) assert.equal(rows.filter((r) => r.payload.event === `${source === EntitlementGrantSource.ReverseTrial ? "trial" : "access"}-${days}d`).length, 1);
		}
});
test("Runner continuation does not infer Runner access from Pro", async () => {
	const { hasContinuingRunner } = await import("@/server/notifications/access-context");
	await grant(EntitlementGrantSource.Partner);
	assert.equal(await hasContinuingRunner("notification-user", startsAt, null, fixture.db), false);
	await fixture.db.insert(entitlementGrantsTable).values({ userId: "notification-user", entitlement: Entitlement.RunnerAccess, source: EntitlementGrantSource.Support, startsAt, endsAt });
	assert.equal(await hasContinuingRunner("notification-user", startsAt, null, fixture.db), true);
	assert.equal(await hasContinuingRunner("notification-user", endsAt, null, fixture.db), false);
});

test("each distinct revoke-and-restore cycle sends a restoration once", async () => {
	const row = await grant();
	for (const date of ["2040-01-02T12:00:00Z", "2040-01-03T12:00:00Z"]) {
		await fixture.db
			.update(entitlementGrantsTable)
			.set({ revokedAt: new Date(date) })
			.where(eq(entitlementGrantsTable.id, row.id));
		await fixture.db.update(entitlementGrantsTable).set({ revokedAt: null }).where(eq(entitlementGrantsTable.id, row.id));
		await fixture.db.update(entitlementGrantsTable).set({ revokedAt: null }).where(eq(entitlementGrantsTable.id, row.id));
	}
	const restored = (await notices()).filter((notice) => notice.payload.event === "restored");
	assert.equal(restored.length, 2);
	assert.notEqual(restored[0].dedupeKey, restored[1].dedupeKey);
});
