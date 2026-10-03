import "server-only";

import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agencyAccountsTable, agencyBillingAccountsTable } from "@/db/schema";
import { resolveAgencyCapacitySnapshot, shouldApplyAgencyStripeSnapshot } from "./billing-policy";

function stripeId(value: string | { id: string } | null | undefined) {
	return typeof value === "string" ? value : (value?.id ?? null);
}

function unixDate(value: number | null | undefined) {
	return typeof value === "number" ? new Date(value * 1000) : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
	const item = subscription.items.data[0];
	return { start: unixDate(item?.current_period_start), end: unixDate(item?.current_period_end) };
}

function persistedBillingStatus(status: Stripe.Subscription.Status): "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled" {
	if (status === "incomplete_expired") return "canceled";
	if (["incomplete", "trialing", "active", "past_due", "unpaid", "paused", "canceled"].includes(status)) return status as "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled";
	return "incomplete";
}

export async function syncAgencyStripeSubscription(subscription: Stripe.Subscription, stripeEventCreated = subscription.created, invoicePaymentConfirmed = false) {
	const organizationId = subscription.metadata.clipifyAgencyOrganizationId;
	const [billing] = organizationId ? await db.select().from(agencyBillingAccountsTable).where(eq(agencyBillingAccountsTable.organizationId, organizationId)).limit(1) : await db.select().from(agencyBillingAccountsTable).where(eq(agencyBillingAccountsTable.stripeSubscriptionId, subscription.id)).limit(1);
	if (!billing) return { handled: false as const };
	if (!shouldApplyAgencyStripeSnapshot(billing.latestStripeEventCreated, stripeEventCreated)) return { handled: true as const, ignoredAsStale: true as const };
	const [account] = await db.select({ creatorSeatLimit: agencyAccountsTable.creatorSeatLimit, runnerSeatLimit: agencyAccountsTable.runnerSeatLimit }).from(agencyAccountsTable).where(eq(agencyAccountsTable.organizationId, billing.organizationId)).limit(1);
	if (!account) return { handled: false as const };

	const creatorItem = subscription.items.data.find((item) => item.price.id === billing.creatorSeatPriceId);
	const runnerItem = billing.runnerSeatPriceId ? subscription.items.data.find((item) => item.price.id === billing.runnerSeatPriceId) : undefined;
	if (!creatorItem) throw new Error("AGENCY_CREATOR_SEAT_ITEM_MISSING");
	const hasPendingUpdate = Boolean(subscription.pending_update);
	const stripeCreatorQuantity = creatorItem.quantity ?? 0;
	const stripeRunnerQuantity = runnerItem?.quantity ?? 0;
	const creatorQuantity = resolveAgencyCapacitySnapshot({ previousQuantity: account.creatorSeatLimit, stripeQuantity: stripeCreatorQuantity, subscriptionStatus: subscription.status, hasPendingUpdate, collectionMethod: billing.collectionMethod, invoicePaymentConfirmed });
	const runnerQuantity = resolveAgencyCapacitySnapshot({ previousQuantity: account.runnerSeatLimit, stripeQuantity: stripeRunnerQuantity, subscriptionStatus: subscription.status, hasPendingUpdate, collectionMethod: billing.collectionMethod, invoicePaymentConfirmed });
	const period = subscriptionPeriod(subscription);

	await db.transaction(async (tx) => {
		const [applied] = await tx
			.update(agencyBillingAccountsTable)
			.set({
				status: persistedBillingStatus(subscription.status),
				stripeCustomerId: stripeId(subscription.customer),
				stripeSubscriptionId: subscription.id,
				stripeSubscriptionScheduleId: stripeId(subscription.schedule),
				creatorSeatItemId: creatorItem.id,
				creatorSeatQuantity: creatorQuantity,
				pendingCreatorSeatQuantity: creatorQuantity === stripeCreatorQuantity ? null : billing.pendingCreatorSeatQuantity,
				runnerSeatItemId: runnerItem?.id ?? null,
				runnerSeatQuantity: runnerQuantity,
				pendingRunnerSeatQuantity: runnerQuantity === stripeRunnerQuantity ? null : billing.pendingRunnerSeatQuantity,
				currentPeriodStart: period.start,
				currentPeriodEnd: period.end,
				latestStripeEventCreated: stripeEventCreated,
				updatedAt: new Date(),
			})
			.where(and(eq(agencyBillingAccountsTable.organizationId, billing.organizationId), sql`${agencyBillingAccountsTable.latestStripeEventCreated} <= ${stripeEventCreated}`))
			.returning({ organizationId: agencyBillingAccountsTable.organizationId });
		if (!applied) return;
		await tx.update(agencyAccountsTable).set({ creatorSeatLimit: creatorQuantity, runnerSeatLimit: runnerQuantity, updatedAt: new Date() }).where(eq(agencyAccountsTable.organizationId, billing.organizationId));
	});
	return { handled: true as const, ignoredAsStale: false as const, creatorQuantity, runnerQuantity };
}
