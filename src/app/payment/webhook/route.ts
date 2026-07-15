/* istanbul ignore file */
"use server";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripe } from "@actions/subscription";
import { db } from "@/db/client";
import { billingWebhookEventsTable } from "@/db/schema";
import { syncStripeSubscription } from "@/server/billing";
import { and, eq } from "drizzle-orm";

const webhookSecret = process.env.STRIPE_WEBHOOK_KEY || "";

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

	const existing = await db.query.billingWebhookEventsTable.findFirst({ where: eq(billingWebhookEventsTable.id, event.id) });
	if (existing?.status === "processed" || existing?.status === "processing") return NextResponse.json({ duplicate: true });

	if (existing?.status === "failed") {
		const [claimedRetry] = await db
			.update(billingWebhookEventsTable)
			.set({ status: "processing", retryCount: existing.retryCount + 1, lastError: null })
			.where(and(eq(billingWebhookEventsTable.id, event.id), eq(billingWebhookEventsTable.status, "failed")))
			.returning({ id: billingWebhookEventsTable.id });
		if (!claimedRetry) return NextResponse.json({ duplicate: true });
	} else {
		const [claimedInsert] = await db.insert(billingWebhookEventsTable).values({ id: event.id, eventType: event.type, status: "processing" }).onConflictDoNothing({ target: billingWebhookEventsTable.id }).returning({ id: billingWebhookEventsTable.id });
		if (!claimedInsert) return NextResponse.json({ duplicate: true });
	}

	try {
		await processEvent(stripe, event);
		await db.update(billingWebhookEventsTable).set({ status: "processed", processedAt: new Date(), lastError: null }).where(eq(billingWebhookEventsTable.id, event.id));
		return NextResponse.json({});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown Stripe webhook error";
		await db.update(billingWebhookEventsTable).set({ status: "failed", lastError: message }).where(eq(billingWebhookEventsTable.id, event.id));
		console.error(`Stripe webhook failed: ${message} | EVENT TYPE: ${event.type}`);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
