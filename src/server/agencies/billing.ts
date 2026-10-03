import "server-only";

import Stripe from "stripe";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agencyBillingAccountsTable, agencyCreatorLinksTable, agencyLicenseAllocationsTable } from "@/db/schema";
import { getStripe } from "@/server/stripe";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { decideAgencySeatChange } from "./billing-policy";
import { syncAgencyStripeSubscription } from "./billing-sync";
import { requireAgencyMember } from "./database";

export type AgencySeatKind = "creator" | "runner";

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

async function requireBillingContext(permission: "billing:read" | "billing:manage" = "billing:read") {
	const actor = await requireAgencyMember(permission);
	const [billing] = await db.select().from(agencyBillingAccountsTable).where(eq(agencyBillingAccountsTable.organizationId, actor.account.organizationId)).limit(1);
	if (!billing) throw new Error("AGENCY_BILLING_NOT_CONFIGURED");
	return { actor, billing };
}

async function ensureStripeCustomer(stripe: Stripe, billing: typeof agencyBillingAccountsTable.$inferSelect) {
	if (billing.stripeCustomerId) return billing.stripeCustomerId;
	const listed = await stripe.customers.list({ email: billing.billingEmail, limit: 10 });
	const existing = listed.data.find((customer) => !customer.deleted && customer.metadata.clipifyAgencyOrganizationId === billing.organizationId) ?? listed.data.find((customer) => !customer.deleted);
	const customer = existing ? await stripe.customers.update(existing.id, { metadata: { ...existing.metadata, clipifyAccountType: "agency", clipifyAgencyOrganizationId: billing.organizationId } }) : await stripe.customers.create({ email: billing.billingEmail, metadata: { clipifyAccountType: "agency", clipifyAgencyOrganizationId: billing.organizationId } }, { idempotencyKey: `clipify-agency-customer:${billing.organizationId}` });
	await db
		.update(agencyBillingAccountsTable)
		.set({ stripeCustomerId: customer.id, updatedAt: new Date() })
		.where(and(eq(agencyBillingAccountsTable.organizationId, billing.organizationId), sql`${agencyBillingAccountsTable.stripeCustomerId} IS NULL`));
	return customer.id;
}

function lineItems(billing: typeof agencyBillingAccountsTable.$inferSelect) {
	const creatorQuantity = billing.pendingCreatorSeatQuantity ?? billing.creatorSeatQuantity;
	const runnerQuantity = billing.pendingRunnerSeatQuantity ?? billing.runnerSeatQuantity;
	const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: billing.creatorSeatPriceId, quantity: creatorQuantity }];
	if (billing.runnerSeatPriceId && runnerQuantity > 0) items.push({ price: billing.runnerSeatPriceId, quantity: runnerQuantity });
	return items;
}

export async function createAgencyBillingStart() {
	const { billing } = await requireBillingContext("billing:manage");
	if (billing.stripeSubscriptionId) return createAgencyBillingPortal();
	const stripe = getStripe();
	const customer = await ensureStripeCustomer(stripe, billing);
	const metadata = { clipifyAccountType: "agency", clipifyAgencyOrganizationId: billing.organizationId };

	if (billing.collectionMethod === "send_invoice") {
		const subscription = await stripe.subscriptions.create(
			{
				customer,
				collection_method: "send_invoice",
				days_until_due: billing.daysUntilDue ?? 14,
				items: lineItems(billing).map((item) => ({ price: String(item.price), quantity: item.quantity })),
				metadata,
				automatic_tax: { enabled: true },
			},
			{ idempotencyKey: `clipify-agency-subscription:${billing.organizationId}` },
		);
		await syncAgencyStripeSubscription(subscription, subscription.created);
		return { kind: "invoice" as const, url: null };
	}

	const baseUrl = resolveBaseUrl();
	const session = await stripe.checkout.sessions.create(
		{
			mode: "subscription",
			customer,
			client_reference_id: billing.organizationId,
			line_items: lineItems(billing),
			success_url: new URL("/dashboard/agency?billing=success", baseUrl).toString(),
			cancel_url: new URL("/dashboard/agency?billing=cancelled", baseUrl).toString(),
			customer_update: { address: "auto", name: "auto" },
			automatic_tax: { enabled: true },
			subscription_data: { metadata },
			metadata,
		},
		{ idempotencyKey: `clipify-agency-checkout:${billing.organizationId}:${billing.creatorSeatQuantity}:${billing.runnerSeatQuantity}` },
	);
	if (!session.url) throw new Error("AGENCY_CHECKOUT_URL_MISSING");
	return { kind: "checkout" as const, url: session.url };
}

export async function createAgencyBillingPortal() {
	const { billing } = await requireBillingContext("billing:manage");
	const stripe = getStripe();
	const customer = await ensureStripeCustomer(stripe, billing);
	const session = await stripe.billingPortal.sessions.create({ customer, return_url: new URL("/dashboard/agency", resolveBaseUrl()).toString() });
	return { kind: "portal" as const, url: session.url };
}

function seatTerms(billing: typeof agencyBillingAccountsTable.$inferSelect, kind: AgencySeatKind) {
	return kind === "creator" ? { priceId: billing.creatorSeatPriceId, itemId: billing.creatorSeatItemId, currentQuantity: billing.creatorSeatQuantity, minimumQuantity: billing.creatorSeatMinimum } : { priceId: billing.runnerSeatPriceId, itemId: billing.runnerSeatItemId, currentQuantity: billing.runnerSeatQuantity, minimumQuantity: billing.runnerSeatMinimum };
}

async function occupiedSeats(organizationId: string, kind: AgencySeatKind) {
	const rows = await db
		.select({ id: agencyLicenseAllocationsTable.id })
		.from(agencyLicenseAllocationsTable)
		.innerJoin(agencyCreatorLinksTable, eq(agencyLicenseAllocationsTable.linkId, agencyCreatorLinksTable.id))
		.where(and(eq(agencyCreatorLinksTable.agencyOrganizationId, organizationId), eq(agencyLicenseAllocationsTable.product, kind === "creator" ? "creator_pro" : "runner"), inArray(agencyLicenseAllocationsTable.status, ["active", "removal_scheduled"])));
	return rows.length;
}

export async function changeAgencySeatQuantity(kind: AgencySeatKind, requestedQuantity: number) {
	const { billing } = await requireBillingContext("billing:manage");
	if (!billing.stripeSubscriptionId) throw new Error("AGENCY_SUBSCRIPTION_REQUIRED");
	if (billing.collectionMethod !== "charge_automatically") throw new Error("AGENCY_INVOICE_BILLING_CONTACT_REQUIRED");
	const terms = seatTerms(billing, kind);
	if (!terms.priceId) throw new Error("AGENCY_SUBSCRIPTION_ITEM_REQUIRED");
	const decision = decideAgencySeatChange({ currentQuantity: terms.currentQuantity, requestedQuantity, minimumQuantity: terms.minimumQuantity, occupiedQuantity: await occupiedSeats(billing.organizationId, kind) });
	if (decision.kind === "unchanged") return decision;
	const stripe = getStripe();

	if (decision.kind === "increase") {
		await stripe.subscriptions.update(billing.stripeSubscriptionId, {
			items: [terms.itemId ? { id: terms.itemId, quantity: decision.quantity } : { price: terms.priceId, quantity: decision.quantity }],
			proration_behavior: decision.prorationBehavior,
			payment_behavior: decision.paymentBehavior,
		});
		return decision;
	}
	if (!terms.itemId) throw new Error("AGENCY_SUBSCRIPTION_ITEM_REQUIRED");

	const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, { expand: ["items.data.price"] });
	const period = subscriptionPeriod(subscription);
	if (!period.end) throw new Error("AGENCY_BILLING_PERIOD_REQUIRED");
	let scheduleId = stripeId(subscription.schedule);
	if (!scheduleId) {
		const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id, metadata: { clipifyAgencyOrganizationId: billing.organizationId } });
		scheduleId = schedule.id;
	}
	const items = subscription.items.data.map((item) => ({ price: item.price.id, quantity: item.id === terms.itemId ? decision.quantity : (item.quantity ?? 1) }));
	await stripe.subscriptionSchedules.update(scheduleId, {
		end_behavior: "release",
		phases: [
			{ start_date: subscription.items.data[0]?.current_period_start, end_date: subscription.items.data[0]?.current_period_end, items: subscription.items.data.map((item) => ({ price: item.price.id, quantity: item.quantity ?? 1 })), proration_behavior: "none" },
			{ start_date: subscription.items.data[0]?.current_period_end, duration: { interval: subscription.items.data[0]?.price.recurring?.interval ?? "month", interval_count: 1 }, items, proration_behavior: "none" },
		],
	});
	await db
		.update(agencyBillingAccountsTable)
		.set(kind === "creator" ? { stripeSubscriptionScheduleId: scheduleId, pendingCreatorSeatQuantity: decision.quantity, updatedAt: new Date() } : { stripeSubscriptionScheduleId: scheduleId, pendingRunnerSeatQuantity: decision.quantity, updatedAt: new Date() })
		.where(eq(agencyBillingAccountsTable.organizationId, billing.organizationId));
	return decision;
}

export { syncAgencyStripeSubscription } from "./billing-sync";
