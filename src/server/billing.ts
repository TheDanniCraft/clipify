import "server-only";

import Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { billingSubscriptionItemsTable, billingSubscriptionsTable, entitlementGrantsTable, usersTable } from "@/db/schema";
import { getProductForPrice } from "@lib/billingCatalog";
import { BillingProduct, Entitlement, EntitlementGrantSource, Plan } from "@types";

const ENTITLED_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

function stripeId(value: string | { id: string } | null) {
	if (typeof value === "string") return value;
	return value?.id ?? null;
}

function unixDate(value: number | null | undefined) {
	return typeof value === "number" ? new Date(value * 1000) : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
	const firstItem = subscription.items.data[0];
	return {
		start: unixDate(firstItem?.current_period_start),
		end: unixDate(firstItem?.current_period_end),
	};
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
	const customerId = stripeId(subscription.customer);
	if (!customerId) throw new Error("Stripe subscription has no customer ID");

	const userId = subscription.metadata.userId || fallbackUserId || (await db.query.usersTable.findFirst({ where: eq(usersTable.stripeCustomerId, customerId) }))?.id;
	if (!userId) throw new Error(`No Clipify user found for Stripe customer ${customerId}`);

	const period = subscriptionPeriod(subscription);
	const items = subscription.items.data
		.map((item) => {
			const productKey = getProductForPrice(item.price.id);
			const productId = stripeId(item.price.product);
			if (!productKey || !productId || !item.price.recurring) return null;
			return {
				id: item.id,
				subscriptionId: subscription.id,
				productKey,
				stripeProductId: productId,
				stripePriceId: item.price.id,
				unitAmount: item.price.unit_amount,
				currency: item.price.currency,
				billingInterval: item.price.recurring.interval,
				quantity: item.quantity ?? 1,
				updatedAt: new Date(),
			};
		})
		.filter((item): item is NonNullable<typeof item> => item !== null);

	await db.transaction(async (tx) => {
		await tx
			.insert(billingSubscriptionsTable)
			.values({
				id: subscription.id,
				userId,
				stripeCustomerId: customerId,
				status: subscription.status,
				currentPeriodStart: period.start,
				currentPeriodEnd: period.end,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
				canceledAt: unixDate(subscription.canceled_at),
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: billingSubscriptionsTable.id,
				set: {
					status: subscription.status,
					currentPeriodStart: period.start,
					currentPeriodEnd: period.end,
					cancelAtPeriodEnd: subscription.cancel_at_period_end,
					canceledAt: unixDate(subscription.canceled_at),
					updatedAt: new Date(),
				},
			});

		await tx.delete(billingSubscriptionItemsTable).where(eq(billingSubscriptionItemsTable.subscriptionId, subscription.id));
		if (items.length > 0) await tx.insert(billingSubscriptionItemsTable).values(items);
	});

	await recomputeBillingEntitlements(userId, customerId);
	return { userId, items };
}

export async function recomputeBillingEntitlements(userId: string, customerId: string) {
	const activeItems = await db
		.select({ productKey: billingSubscriptionItemsTable.productKey })
		.from(billingSubscriptionItemsTable)
		.innerJoin(billingSubscriptionsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id))
		.where(and(eq(billingSubscriptionsTable.userId, userId), inArray(billingSubscriptionsTable.status, ENTITLED_STATUSES)));

	const products = new Set(activeItems.map((item) => item.productKey));
	const hasPro = products.has(BillingProduct.Pro);
	const hasRunner = products.has(BillingProduct.RunnerSelfHosted);
	const now = new Date();

	await db
		.update(usersTable)
		.set({ plan: hasPro ? Plan.Pro : Plan.Free, stripeCustomerId: customerId, updatedAt: now })
		.where(eq(usersTable.id, userId));

	const externalReference = `stripe_customer:${customerId}`;
	await db
		.insert(entitlementGrantsTable)
		.values({
			userId,
			entitlement: Entitlement.RunnerAccess,
			source: EntitlementGrantSource.Billing,
			reason: "stripe_subscription",
			externalReference,
			startsAt: now,
			revokedAt: hasRunner ? null : now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [entitlementGrantsTable.source, entitlementGrantsTable.externalReference, entitlementGrantsTable.entitlement],
			set: { userId, revokedAt: hasRunner ? null : now, endsAt: null, updatedAt: now },
		});
}
