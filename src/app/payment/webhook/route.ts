"use server";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { downgradeUserPlan, getUserByCustomerId, updateUserSubscription } from "@/app/actions/database";
import { getPlans, getStripe } from "@/app/actions/subscription";
import { Plan } from "@/app/lib/types";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_KEY || "";

export async function POST(req: Request) {
	const body = await req.text();
	const stripe = await getStripe();

	const signature = (await headers()).get("stripe-signature") || "";

	let event;

	// verify Stripe event is legit
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
			case "checkout.session.completed": {
				const session = await stripe.checkout.sessions.retrieve((data.object as Stripe.Checkout.Session).id, {
					expand: ["line_items"],
				});

				if (!session) {
					console.error("No session found");
					return NextResponse.json({ error: "No session found" });
				}

				const customerId = session.customer;
				if (typeof customerId !== "string") {
					console.error("Invalid customer ID");
					return NextResponse.json({ error: "Invalid customer ID" });
				}
				const priceId = session.line_items?.data[0]?.price?.id;

				if (!priceId) {
					console.error("No price ID found in session");
					return NextResponse.json({ error: "No price ID found in session" });
				}

				const subscriptionId = session.subscription;
				if (!subscriptionId || typeof subscriptionId !== "string") {
					console.error("No subscription ID found in session");
					return NextResponse.json({ error: "No subscription ID found in session" });
				}

				const plans = await getPlans();

				if (!plans.some((plan: string) => plan === priceId)) {
					console.error(`No plan found for price ID: ${priceId}`);
					return NextResponse.json({ error: "No plan found for this price" });
				}

				const referenceId = session.client_reference_id;

				if (!referenceId) {
					console.error("No reference ID found in session metadata");
					return NextResponse.json({ error: "No reference ID found in session metadata" });
				}

				updateUserSubscription(referenceId, customerId, Plan.Pro);
				break;
			}

			case "customer.subscription.deleted": {
				const subscription = await stripe.subscriptions.retrieve((data.object as Stripe.Checkout.Session).id);

				if (!subscription) {
					console.error("No subscription found");
					return NextResponse.json({ error: "No subscription found" });
				}

				const user = await getUserByCustomerId(subscription.customer as string);
				if (!user) {
					console.error("No user found for subscription");
					return NextResponse.json({ error: "No user found for this subscription" });
				}

				updateUserSubscription(user.id, subscription.customer as string, Plan.Free);

				await downgradeUserPlan(user.id);

				break;
			}

			default:
		}
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : "Unknown error";
		console.error("stripe error: " + errorMessage + " | EVENT TYPE: " + eventType);
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}

	return NextResponse.json({});
}
