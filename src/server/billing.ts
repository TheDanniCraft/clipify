import { queuePaymentRecoveryEnded } from "@/server/notifications/pro-events";
import "server-only";

import { queueCancellationEmail, queueSubscriptionCancellationReminders } from "@/server/notifications/benefit-events";
import Stripe from "stripe";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db, type QueryClient } from "@/db/client";
import { billingSubscriptionItemsTable, billingSubscriptionsTable, entitlementGrantsTable, usersTable } from "@/db/schema";
import { resolveBillingProductForPrice } from "@/server/billingCatalog";
import { BillingProduct, Entitlement, EntitlementGrantSource, Plan } from "@types";
import { reconcileUserEntitlements } from "@lib/entitlements";

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

type BillingTransition = { subscription: Stripe.Subscription; previous: typeof billingSubscriptionsTable.$inferSelect | undefined; userId: string; stripeEventCreated: number; period: { end: Date | null }; products: Set<BillingProduct> };
function recoveryFailedFor(subscription: Stripe.Subscription, previous: BillingTransition["previous"]) {
	const cancellationReason = subscription.cancellation_details?.reason;
	return subscription.status === "unpaid" || cancellationReason === "payment_failed" || (subscription.status === "canceled" && !cancellationReason && ["past_due", "unpaid"].includes(previous?.status ?? ""));
}
async function queueRecoveryNotice(input: BillingTransition, recoveryFailed: boolean, tx: QueryClient) {
	const { previous, subscription, products, userId, stripeEventCreated } = input;
	if (previous && recoveryFailed && ["active", "trialing", "past_due"].includes(previous.status) && ["unpaid", "canceled"].includes(subscription.status) && products.has(BillingProduct.Pro)) await queuePaymentRecoveryEnded({ userId, subscriptionId: subscription.id, eventCreated: stripeEventCreated }, tx);
}
function isNewCancellation(subscription: Stripe.Subscription, previous: BillingTransition["previous"]) {
	return (!previous?.cancelAtPeriodEnd && subscription.cancel_at_period_end) || (previous && previous.status !== "canceled" && subscription.status === "canceled" && !previous.cancelAtPeriodEnd);
}
async function queueNewCancellation(input: BillingTransition, recoveryFailed: boolean, tx: QueryClient) {
	const { previous, subscription, products, userId, stripeEventCreated, period } = input;
	const newlyCanceled = isNewCancellation(subscription, previous);
	if (!newlyCanceled) return;
	for (const product of products) {
		if (recoveryFailed && product === BillingProduct.Pro) continue;
		await queueCancellationEmail({ subscriptionId: subscription.id, userId, eventCreated: stripeEventCreated, benefit: product === BillingProduct.RunnerSelfHosted ? "runner" : "pro", endsAt: subscription.status === "canceled" ? null : period.end }, tx);
	}
}
function cancellationHasEnded(subscription: Stripe.Subscription, previous: BillingTransition["previous"], recoveryFailed: boolean) {
	return subscription.status === "canceled" && previous?.cancelAtPeriodEnd && !recoveryFailed;
}
async function queueCancellationCountdowns(input: BillingTransition, recoveryFailed: boolean, tx: QueryClient) {
	const { subscription, previous, products, userId, period } = input;
	if (!period.end) return;
	for (const product of products) {
		if (![BillingProduct.Pro, BillingProduct.RunnerSelfHosted].includes(product)) continue;
		const benefit = product === BillingProduct.RunnerSelfHosted ? "runner" : "pro";
		const details = { subscriptionId: subscription.id, userId, endsAt: period.end, ...(benefit === "runner" ? { benefit: "runner" as const } : {}) };
		if (subscription.cancel_at_period_end && ENTITLED_STATUSES.includes(subscription.status)) await queueSubscriptionCancellationReminders(details, tx);
		if (cancellationHasEnded(subscription, previous, recoveryFailed)) await queueSubscriptionCancellationReminders({ ...details, ended: true }, tx);
	}
}
async function queueBillingTransition(input: BillingTransition, tx: QueryClient) {
	const recoveryFailed = recoveryFailedFor(input.subscription, input.previous);
	await queueRecoveryNotice(input, recoveryFailed, tx);
	await queueNewCancellation(input, recoveryFailed, tx);
	await queueCancellationCountdowns(input, recoveryFailed, tx);
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null, stripeEventCreated = subscription.created) {
	const customerId = stripeId(subscription.customer);
	if (!customerId) throw new Error("Stripe subscription has no customer ID");

	const userId = subscription.metadata.userId || fallbackUserId || (await db.query.usersTable.findFirst({ where: eq(usersTable.stripeCustomerId, customerId) }))?.id;
	if (!userId) throw new Error(`No Clipify user found for Stripe customer ${customerId}`);

	const period = subscriptionPeriod(subscription);
	const items = (
		await Promise.all(
			subscription.items.data.map(async (item) => {
				const productKey = await resolveBillingProductForPrice(item.price);
				const productId = stripeId(item.price.product);
				if (!productKey) throw new Error(`Unable to resolve billing product for Stripe price ${item.price.id}`);
				if (!productId || !item.price.recurring) throw new Error(`Stripe subscription item ${item.id} is missing recurring product data`);
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
			}),
		)
	).filter((item): item is NonNullable<typeof item> => item !== null);

	const applied = await db.transaction(async (tx) => {
		const [previous] = await tx.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.id, subscription.id)).limit(1).for("update");
		const [updated] = await tx
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
				latestStripeEventCreated: stripeEventCreated,
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
					latestStripeEventCreated: stripeEventCreated,
					updatedAt: new Date(),
				},
				setWhere: sql`${billingSubscriptionsTable.latestStripeEventCreated} < ${stripeEventCreated}`,
			})
			.returning({ id: billingSubscriptionsTable.id });
		if (!updated) return false;

		await tx.delete(billingSubscriptionItemsTable).where(eq(billingSubscriptionItemsTable.subscriptionId, subscription.id));
		if (items.length > 0) await tx.insert(billingSubscriptionItemsTable).values(items);
		await queueBillingTransition({ subscription, previous, userId, stripeEventCreated, period, products: new Set(items.map((item) => item.productKey)) }, tx);

		return true;
	});
	if (!applied) return { userId, items: [], ignoredAsStale: true };

	await recomputeBillingEntitlements(userId, customerId);
	return { userId, items, ignoredAsStale: false };
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

	await reconcileUserEntitlements(userId);
}
