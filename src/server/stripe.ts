import "server-only";

import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
	if (!stripe) {
		const key = process.env.STRIPE_SECRET_KEY;
		if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
		stripe = new Stripe(key);
	}
	return stripe;
}
