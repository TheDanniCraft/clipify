"use server";

import Stripe from "stripe";
import { AuthenticatedUser } from "../lib/types";
import { getBaseUrl } from "@actions/utils";

const PRODUCTS = {
	dev: ["price_1RaLC2B0sp7KYCWLkJGjDq3q", "price_1Ru0WHB0sp7KYCWLBbdT0ZH7"],
	prod: ["price_1S83PSB0sp7KYCWLzhUkxodR", "price_1S83Y2B0sp7KYCWL0YDGoqjG"],
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
	const baseUrl = await getBaseUrl();

	const session = await stripe.checkout.sessions.create({
		line_items: [{ price: products[0], quantity: 1 }],
		client_reference_id: user.id,
		mode: "subscription",
		success_url: `${baseUrl}/dashboard/settings`,
		cancel_url: returnUrl || `${baseUrl}/dashboard/settings`,
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
		...(user.stripeCustomerId ? { customer_update: { name: "auto", address: "auto" } } : {}),
	});

	return session.url;
}

export async function getPortalLink(user: AuthenticatedUser) {
	if (!user.stripeCustomerId) {
		throw new Error("User does not have a Stripe customer ID");
	}

	const stripe = await getStripe();
	const baseUrl = await getBaseUrl();

	const session = await stripe.billingPortal.sessions.create({
		customer: user.stripeCustomerId,
		return_url: `${baseUrl}/dashboard/settings`,
	});

	return session.url;
}
