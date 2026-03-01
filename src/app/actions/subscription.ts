"use server";

import Stripe from "stripe";
import { AuthenticatedUser, NumokStripeMetadata } from "@types";
import { getBaseUrl } from "@actions/utils";
import { cookies } from "next/headers";
import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export type BillingCycle = "monthly" | "yearly";
export type PaywallSource = "pricing_page" | "upgrade_modal" | "paywall_banner";

const PRODUCTS = {
	dev: {
		monthly: "price_1SnM3MBg46KdNQq5MjHMYyYw",
		yearly: "price_1SnMAsBg46KdNQq5k8cI6Y8M",
	},
	prod: {
		monthly: "price_1S83PSB0sp7KYCWLzhUkxodR",
		yearly: "price_1S83Y2B0sp7KYCWL0YDGoqjG",
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

async function getAuthorizedUser(requestedUser: Pick<AuthenticatedUser, "id">) {
	const authUser = await validateAuth(false);
	if (!authUser) {
		throw new Error("Unauthorized");
	}
	if (requestedUser.id !== authUser.id) {
		throw new Error("Forbidden");
	}
	return authUser;
}

export async function checkIfSubscriptionExists(user: AuthenticatedUser) {
	const authUser = await getAuthorizedUser(user);
	if (!authUser.stripeCustomerId) {
		return false;
	}

	const stripe = await getStripe();

	const subscriptions = await stripe.subscriptions.list({
		customer: authUser.stripeCustomerId,
		status: "all",
		limit: 100,
	});

	const blockingStatuses: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "unpaid"];
	return subscriptions.data.some((subscription) => blockingStatuses.includes(subscription.status));
}

async function persistStripeCustomerId(userId: string, customerId: string) {
	const result = await db
		.update(usersTable)
		.set({
			stripeCustomerId: customerId,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.id, userId))
		.returning({ id: usersTable.id })
		.execute();
	return result.length > 0;
}

export async function generatePaymentLink(user: AuthenticatedUser, billingCycle: BillingCycle, returnUrl?: string, numokMetadata?: NumokStripeMetadata, source?: PaywallSource) {
	const authUser = await getAuthorizedUser(user);
	const cookieStore = await cookies();
	const products = await getPlans();
	const selectedPrice = products[billingCycle];
	if (!selectedPrice) {
		throw new Error(`Missing Stripe price for billing cycle: ${billingCycle}`);
	}

	const stripe = await getStripe();
	const baseUrl = await getBaseUrl();
	const defaultReturnUrl = new URL("/dashboard/settings", baseUrl).toString();
	const cancelUrl = (() => {
		if (!returnUrl) return defaultReturnUrl;
		try {
			const resolved = new URL(returnUrl, baseUrl);
			if (resolved.origin !== baseUrl.origin) return defaultReturnUrl;
			return resolved.toString();
		} catch {
			return defaultReturnUrl;
		}
	})();
	let stripeCustomerId = authUser.stripeCustomerId ?? null;

	if (!stripeCustomerId) {
		const customer = await stripe.customers.create({
			email: authUser.email,
			metadata: {
				userId: authUser.id,
				source: source ?? "upgrade_modal",
			},
		});
		stripeCustomerId = customer.id;
		const persisted = await persistStripeCustomerId(authUser.id, customer.id);
		if (!persisted) {
			throw new Error("Failed to persist Stripe customer ID");
		}
		console.info("[entitlements] stripe_customer_created_on_intent", { userId: authUser.id, customerId: customer.id, source: source ?? "upgrade_modal" });
	}

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

	const baseSessionParams: Stripe.Checkout.SessionCreateParams = {
		line_items: [{ price: selectedPrice, quantity: 1 }],
		client_reference_id: authUser.id,
		mode: "subscription",
		success_url: defaultReturnUrl,
		cancel_url: cancelUrl,
		customer: stripeCustomerId,
		metadata: {
			userId: authUser.id,
			source: source ?? "upgrade_modal",
			billingCycle,
			...numokMetadata,
		},
		tax_id_collection: {
			enabled: true,
		},
		customer_update: { name: "auto", address: "auto" },
	};

	const createSession = async (usePromo: boolean) => {
		return stripe.checkout.sessions.create({
			...baseSessionParams,
			...(usePromo && promo ? { discounts: [{ promotion_code: promo.id }] } : { allow_promotion_codes: true }),
		});
	};

	let session: Stripe.Checkout.Session;
	try {
		session = await createSession(true);
	} catch (error) {
		const err = error as Stripe.StripeRawError;
		const msg = err?.message || "";
		const code = err?.code || "";
		const promoNotRedeemable = code === "promotion_code_not_redeemable" || msg.includes("promotion code cannot be redeemed");

		if (promo && promoNotRedeemable) {
			session = await createSession(false);
		} else {
			throw error;
		}
	}

	return session.url;
}

export async function getPortalLink(user: AuthenticatedUser) {
	const authUser = await getAuthorizedUser(user);
	if (!authUser.stripeCustomerId) {
		throw new Error("User does not have a Stripe customer ID");
	}

	const stripe = await getStripe();
	const baseUrl = await getBaseUrl();

	const session = await stripe.billingPortal.sessions.create({
		customer: authUser.stripeCustomerId,
		return_url: new URL("/dashboard/settings", baseUrl).toString(),
	});

	return session.url;
}
