"use server";

import Stripe from "stripe";
import { AuthenticatedUser } from "../lib/types";

const PRODUCTS = {
	dev: {
		id: "price_1RaLC2B0sp7KYCWLkJGjDq3q",
	},
	prod: {
		id: "price_1RaJ4ZB0sp7KYCWLOst1iqLA",
	},
};

let stripe: Stripe | null = null;

export async function getStripe() {
	if (stripe) {
		return stripe;
	}
	stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

	return stripe;
}

export async function getPlans() {
	const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
	return PRODUCTS[env];
}

export async function checkIfSubscriptionExists(user: AuthenticatedUser) {
	if (!user.stripeCustomerId) {
		return false;
	}

	const stripe = await getStripe();

	const subscriptions = await stripe.subscriptions.list({
		customer: user.stripeCustomerId,
		status: "active",
	});

	return subscriptions.data.length > 0;
}

export async function generatePaymentLink(user: AuthenticatedUser, returnUrl?: string) {
	const products = await getPlans();

	const stripe = await getStripe();

	const session = await stripe.checkout.sessions.create({
		line_items: [{ price: products.id, quantity: 1 }],
		client_reference_id: user.id,
		mode: "subscription",
		success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings`,
		cancel_url: returnUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings`,
		...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
		metadata: {
			userId: user.id,
		},
		allow_promotion_codes: true,
		tax_id_collection: {
			enabled: true,
		},
		subscription_data: {
			trial_period_days: 3,
		},
		customer_update: {
			name: "auto",
		},
	});

	return session.url;
}

export async function getPortalLink(user: AuthenticatedUser) {
	if (!user.stripeCustomerId) {
		throw new Error("User does not have a Stripe customer ID");
	}

	const stripe = await getStripe();

	const session = await stripe.billingPortal.sessions.create({
		customer: user.stripeCustomerId,
		return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings`,
	});

	return session.url;
}
