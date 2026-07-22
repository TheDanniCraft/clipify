/* istanbul ignore file */
"use server";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripe } from "@actions/subscription";
import { db } from "@/db/client";
import { billingWebhookEventsTable } from "@/db/schema";
import { syncStripeSubscription } from "@/server/billing";
import { and, eq, isNull, lt, or } from "drizzle-orm";

const webhookSecret = process.env.STRIPE_WEBHOOK_KEY || "";
const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

type WebhookClaim = { status: "claimed"; processingStartedAt: Date } | { status: "processed" } | { status: "busy" };

async function claimWebhookEvent(event: Stripe.Event, now = new Date()): Promise<WebhookClaim> {
	const staleBefore = new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS);
	let existing = await db.query.billingWebhookEventsTable.findFirst({ where: eq(billingWebhookEventsTable.id, event.id) });

	if (!existing) {
		const [inserted] = await db.insert(billingWebhookEventsTable).values({ id: event.id, eventType: event.type, status: "processing", processingStartedAt: now }).onConflictDoNothing({ target: billingWebhookEventsTable.id }).returning({ id: billingWebhookEventsTable.id });
		if (inserted) return { status: "claimed", processingStartedAt: now };

		existing = await db.query.billingWebhookEventsTable.findFirst({ where: eq(billingWebhookEventsTable.id, event.id) });
	}

	if (!existing) return { status: "busy" };
	if (existing.status === "processed") return { status: "processed" };
	if (existing.status === "processing" && existing.processingStartedAt && existing.processingStartedAt >= staleBefore) return { status: "busy" };

	const claimCondition = existing.status === "failed" ? and(eq(billingWebhookEventsTable.id, event.id), eq(billingWebhookEventsTable.status, "failed")) : and(eq(billingWebhookEventsTable.id, event.id), eq(billingWebhookEventsTable.status, "processing"), or(isNull(billingWebhookEventsTable.processingStartedAt), lt(billingWebhookEventsTable.processingStartedAt, staleBefore)));
	const [claimed] = await db
		.update(billingWebhookEventsTable)
		.set({ status: "processing", processingStartedAt: now, retryCount: existing.retryCount + 1, lastError: null })
		.where(claimCondition)
		.returning({ id: billingWebhookEventsTable.id });

	return claimed ? { status: "claimed", processingStartedAt: now } : { status: "busy" };
}

async function getCanonicalSubscription(stripe: Stripe, subscription: string | Stripe.Subscription | null) {
	const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
	if (!subscriptionId) throw new Error("Checkout session has no subscription");
	return stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
}

async function processEvent(stripe: Stripe, event: Stripe.Event) {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id, { expand: ["subscription"] });
			const subscription = await getCanonicalSubscription(stripe, session.subscription);
			await syncStripeSubscription(subscription, session.client_reference_id);
			return;
		}
		case "customer.subscription.created":
		case "customer.subscription.updated":
		case "customer.subscription.deleted": {
			const subscription = await getCanonicalSubscription(stripe, event.data.object as Stripe.Subscription);
			await syncStripeSubscription(subscription);
			return;
		}
		default:
			return;
	}
}

export async function POST(req: Request) {
	const body = await req.text();
	const stripe = await getStripe();
	const signature = (await headers()).get("stripe-signature") || "";

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown signature error";
		console.error(`Stripe webhook signature verification failed: ${message}`);
		return NextResponse.json({ error: message }, { status: 400 });
	}

	const handledEvents = new Set(["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
	if (!handledEvents.has(event.type)) return NextResponse.json({});

	const claim = await claimWebhookEvent(event);
	if (claim.status === "processed") return NextResponse.json({ duplicate: true });
	if (claim.status === "busy") return NextResponse.json({ error: "Webhook event is already being processed" }, { status: 503, headers: { "Retry-After": "30" } });
	const leaseCondition = and(eq(billingWebhookEventsTable.id, event.id), eq(billingWebhookEventsTable.status, "processing"), eq(billingWebhookEventsTable.processingStartedAt, claim.processingStartedAt));

	try {
		await processEvent(stripe, event);
		await db.update(billingWebhookEventsTable).set({ status: "processed", processingStartedAt: null, processedAt: new Date(), lastError: null }).where(leaseCondition);
		return NextResponse.json({});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown Stripe webhook error";
		await db.update(billingWebhookEventsTable).set({ status: "failed", processingStartedAt: null, lastError: message }).where(leaseCondition);
		console.error(`Stripe webhook failed: ${message} | EVENT TYPE: ${event.type}`);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
