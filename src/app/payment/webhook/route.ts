"use server";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { downgradeUserPlan, getUserByCustomerId, updateUserSubscription } from "@actions/database";
import { getPlans, getStripe } from "@actions/subscription";
import { Plan } from "@types";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_KEY || "";

function getSubscriptionCustomerId(subscription: Stripe.Subscription) {
	const customer = subscription.customer;
	if (typeof customer === "string") return customer;
	if (customer && typeof customer === "object" && "id" in customer && typeof customer.id === "string") return customer.id;
	return null;
}

async function handleCheckoutSessionCompleted(stripe: Stripe, data: Stripe.Event.Data) {
	const session = await stripe.checkout.sessions.retrieve((data.object as Stripe.Checkout.Session).id, {
		expand: ["line_items"],
	});
	if (!session) return NextResponse.json({ error: "No session found" });

	const customerId = session.customer;
	if (typeof customerId !== "string") return NextResponse.json({ error: "Invalid customer ID" });

	const priceId = session.line_items?.data[0]?.price?.id;
	if (!priceId) return NextResponse.json({ error: "No price ID found in session" });

	if (!session.subscription || typeof session.subscription !== "string") return NextResponse.json({ error: "No subscription ID found in session" });

	const plans = await getPlans();
	if (!Object.values(plans).some((plan) => plan === priceId)) return NextResponse.json({ error: "No plan found for this price" });

	const referenceId = session.client_reference_id;
	if (!referenceId) return NextResponse.json({ error: "No reference ID found in session metadata" });

	await updateUserSubscription(referenceId, customerId, Plan.Pro);
	return NextResponse.json({});
}

async function handleCustomerSubscriptionDeleted(data: Stripe.Event.Data) {
	const subscription = data.object as Stripe.Subscription;
	if (!subscription) return NextResponse.json({ error: "No subscription found" });
	const customerId = getSubscriptionCustomerId(subscription);
	if (!customerId) return NextResponse.json({ error: "Invalid customer ID in subscription" });

	const user = await getUserByCustomerId(customerId);
	if (!user) return NextResponse.json({ error: "No user found for this subscription" });

	await updateUserSubscription(user.id, customerId, Plan.Free);
	await downgradeUserPlan(user.id);

	return NextResponse.json({});
}

async function handleCustomerSubscriptionUpdated(data: Stripe.Event.Data) {
	const subscription = data.object as Stripe.Subscription;
	if (!subscription) return NextResponse.json({ error: "No subscription found" });
	const customerId = getSubscriptionCustomerId(subscription);
	if (!customerId) return NextResponse.json({ error: "Invalid customer ID in subscription" });

	const user = await getUserByCustomerId(customerId);
	if (!user) return NextResponse.json({ error: "No user found for this subscription" });

	const activeStatuses = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
	const nextPlan = activeStatuses.has(subscription.status) ? Plan.Pro : Plan.Free;
	await updateUserSubscription(user.id, customerId, nextPlan);
	if (nextPlan === Plan.Free) {
		await downgradeUserPlan(user.id);
	}

	return NextResponse.json({});
}

export async function POST(req: Request) {
	const body = await req.text();
	const stripe = await getStripe();
	const signature = (await headers()).get("stripe-signature") || "";

	let event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err) {
		const errorMessage = (err as Error).message || "Unknown error";
		console.error(`Webhook signature verification failed. ${errorMessage}`);
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}

	const data: Stripe.Event.Data = event.data;
	const eventType = event.type;

	try {
		switch (eventType) {
			case "checkout.session.completed":
				return await handleCheckoutSessionCompleted(stripe, data);
			case "customer.subscription.deleted":
				return await handleCustomerSubscriptionDeleted(data);
			case "customer.subscription.updated":
				return await handleCustomerSubscriptionUpdated(data);
			default:
				return NextResponse.json({});
		}
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : "Unknown error";
		console.error("stripe error: " + errorMessage + " | EVENT TYPE: " + eventType);
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}
}
