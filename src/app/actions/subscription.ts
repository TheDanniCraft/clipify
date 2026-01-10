"use server";

import Stripe from "stripe";
import { AuthenticatedUser, NumokStripeMetadata } from "@types";
import { getBaseUrl } from "@actions/utils";
import { cookies } from "next/headers";

const PRODUCTS = {
	dev: ["price_1SnM3MBg46KdNQq5MjHMYyYw", "price_1SnMAsBg46KdNQq5k8cI6Y8M"],
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

export async function isEligibleForTrial(user: AuthenticatedUser) {
	if (!user.stripeCustomerId) {
		return true;
	}

	const stripe = await getStripe();
	const tiers = await getPlans();

	const subscriptions = await stripe.subscriptions.list({
		customer: user.stripeCustomerId,
		status: "all",
		expand: ["data.items.data.price"],
		limit: 100,
	});

	// any subscription with a trial for one of the current prices
	const hasTrialForTrackedPrices = subscriptions.data.some((sub) => {
		const hadTrial = sub.trial_start != null && sub.trial_end != null && sub.trial_end > sub.trial_start;

		if (!hadTrial) return false;

		const hasTrackedPrice = sub.items.data.some((item) => tiers.includes(item.price.id));

		return hasTrackedPrice;
	});

	// eligible if they have NOT yet trialed any of these prices
	return !hasTrialForTrackedPrices;
}

export async function generatePaymentLink(user: AuthenticatedUser, returnUrl?: string, numokMetadata?: NumokStripeMetadata) {
	const cookieStore = await cookies();
	const products = await getPlans();

	const stripe = await getStripe();
	const baseUrl = await getBaseUrl();

	const rawCode = cookieStore.get("offer")?.value;
	const offerCode = rawCode?.trim();
	let promo: Stripe.PromotionCode | null = null;
	if (offerCode && /^[A-Za-z0-9]+$/.test(offerCode)) {
		const promoList = await stripe.promotionCodes.list({
			code: offerCode,
			limit: 1,
		});
		promo = promoList.data.length ? promoList.data[0] : null;
	}

	const session = await stripe.checkout.sessions.create({
		line_items: [{ price: products[0], quantity: 1 }],
		client_reference_id: user.id,
		mode: "subscription",
		success_url: `${baseUrl}/dashboard/settings`,
		cancel_url: returnUrl || `${baseUrl}/dashboard/settings`,
		...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
		metadata: {
			userId: user.id,
			...numokMetadata,
		},
		tax_id_collection: {
			enabled: true,
		},
		subscription_data: (await isEligibleForTrial(user)) ? { trial_period_days: 3 } : {},
		...(user.stripeCustomerId ? { customer_update: { name: "auto", address: "auto" } } : {}),
		...(promo ? { discounts: [{ promotion_code: promo.id }] } : { allow_promotion_codes: true }),
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
