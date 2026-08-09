/* istanbul ignore file */
"use server";

import Stripe from "stripe";
import { BillingProduct, NumokStripeMetadata } from "@types";
import { resolveBillingCatalog, resolveBillingPrice, resolveBillingProductForPrice } from "@/server/billingCatalog";
import { getStripe as getServerStripe } from "@/server/stripe";
import { getBaseUrl } from "@actions/utils";
import { cookies } from "next/headers";
import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { billingSubscriptionItemsTable, billingSubscriptionsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActiveCampaignOffer } from "@lib/campaignOffers";
import { tryRateLimit } from "@actions/rateLimit";
import { resolveUserEntitlements } from "@lib/entitlements";
import { isProductOwnedByEntitlement } from "@lib/billingOwnership";

export type BillingCycle = "monthly" | "yearly";
export type PaywallSource = "pricing_page" | "upgrade_modal" | "paywall_banner";

export type BillingProductOption = {
	key: BillingProduct;
	label: string;
	description: string;
	category: "plan" | "addon";
	owned: boolean;
	required: boolean;
	selectable: boolean;
	prices: Record<BillingCycle, { amount: number | null; currency: string; formatted: string }>;
};

export type BillingOverview = {
	status: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	products: Array<{
		key: BillingProduct;
		label: string;
		active: boolean;
		billingInterval: BillingCycle | null;
		unitAmount: number | null;
		currency: string;
		currentPeriodEnd: string | null;
		cancelAtPeriodEnd: boolean;
		source: "billing" | "grant";
	}>;
	canManageInApp: boolean;
};

const BILLING_PRODUCT_INFO: Record<BillingProduct, { label: string; description: string; category: "plan" | "addon" }> = {
	[BillingProduct.Pro]: { label: "Pro", description: "Unlock multiple overlays, unlimited playlists, advanced filters, and Pro features.", category: "plan" },
	[BillingProduct.RunnerSelfHosted]: { label: "Self-hosted Runner", description: "Run Clipify overlays from your own computer or server.", category: "addon" },
};

export async function getPlans() {
	const catalog = await resolveBillingCatalog();
	return { monthly: catalog[BillingProduct.Pro].monthly.priceId, yearly: catalog[BillingProduct.Pro].yearly.priceId };
}

export async function getStripe() {
	return getServerStripe();
}

export async function getBillingProductOptions(primaryProduct: BillingProduct) {
	const authUser = await getAuthorizedUser();
	const entitlements = await resolveUserEntitlements(authUser);
	const catalog = await resolveBillingCatalog();
	let preferredBillingCycle: BillingCycle | null = null;
	if (authUser.stripeCustomerId) {
		const stripe = getServerStripe();
		const subscriptions = await stripe.subscriptions.list({ customer: authUser.stripeCustomerId, status: "all", limit: 100 });
		for (const subscription of subscriptions.data) {
			if (!["active", "trialing", "past_due", "unpaid"].includes(subscription.status)) continue;
			const mappedItems = await Promise.all(subscription.items.data.map(async (item) => ({ item, product: await resolveBillingProductForPrice(item.price, stripe) })));
			const proItem = mappedItems.find((entry) => entry.product === BillingProduct.Pro)?.item;
			if (proItem?.price.recurring?.interval === "month") {
				preferredBillingCycle = "monthly";
				break;
			}
			if (proItem?.price.recurring?.interval === "year") preferredBillingCycle = "yearly";
		}
	}
	const products = Object.values(BillingProduct);
	const options = await Promise.all(
		products.map(async (product) => {
			const prices = await Promise.all(
				(["monthly", "yearly"] as BillingCycle[]).map(async (cycle) => {
					const price = catalog[product]?.[cycle];
					return price ? { amount: price.amount, currency: price.currency, formatted: price.formatted } : { amount: null, currency: "EUR", formatted: "Unavailable" };
				}),
			);
			const ownedBySubscription = await checkIfSubscriptionExists(product);
			const ownedByEntitlement = isProductOwnedByEntitlement(product, entitlements);
			const owned = ownedBySubscription || ownedByEntitlement;
			return {
				key: product,
				...BILLING_PRODUCT_INFO[product],
				owned,
				required: product === primaryProduct && !owned,
				selectable: !owned && product !== primaryProduct,
				prices: { monthly: prices[0], yearly: prices[1] },
			};
		}),
	);
	return { primaryProduct, userId: authUser.id, preferredBillingCycle, options } satisfies { primaryProduct: BillingProduct; userId: string; preferredBillingCycle: BillingCycle | null; options: BillingProductOption[] };
}

export async function getBillingOverview(): Promise<BillingOverview> {
	const authUser = await getAuthorizedUser();
	const rows = await db.select({ subscription: billingSubscriptionsTable, item: billingSubscriptionItemsTable }).from(billingSubscriptionsTable).leftJoin(billingSubscriptionItemsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id)).where(eq(billingSubscriptionsTable.userId, authUser.id)).execute();
	const activeRows = rows.filter(({ subscription }) => ["active", "trialing", "past_due", "unpaid"].includes(subscription.status));
	const subscription = activeRows[0]?.subscription;
	const products: BillingOverview["products"] = activeRows.flatMap(({ item, subscription: rowSubscription }) =>
		item ? [{ key: item.productKey, label: BILLING_PRODUCT_INFO[item.productKey]?.label ?? item.productKey, active: true, billingInterval: item.billingInterval === "year" ? ("yearly" as const) : ("monthly" as const), unitAmount: item.unitAmount, currency: item.currency.toUpperCase(), currentPeriodEnd: rowSubscription.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: Boolean(rowSubscription.cancelAtPeriodEnd), source: "billing" as const }] : [],
	);
	const entitlements = await resolveUserEntitlements(authUser);
	if (entitlements.proAccess && !products.some((product) => product.key === BillingProduct.Pro)) {
		products.push({ key: BillingProduct.Pro, label: BILLING_PRODUCT_INFO[BillingProduct.Pro].label, active: true, billingInterval: null, unitAmount: null, currency: "EUR", currentPeriodEnd: entitlements.trialEndsAt ? new Date(entitlements.trialEndsAt).toISOString() : null, cancelAtPeriodEnd: false, source: "grant" });
	}
	if (entitlements.runnerAccess && !products.some((product) => product.key === BillingProduct.RunnerSelfHosted)) {
		products.push({ key: BillingProduct.RunnerSelfHosted, label: BILLING_PRODUCT_INFO[BillingProduct.RunnerSelfHosted].label, active: true, billingInterval: null, unitAmount: null, currency: "EUR", currentPeriodEnd: null, cancelAtPeriodEnd: false, source: "grant" });
	}
	return {
		status: subscription?.status ?? (entitlements.proAccess || entitlements.runnerAccess ? "active" : "inactive"),
		currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
		cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
		products,
		canManageInApp: products.length === 1,
	};
}

export async function scheduleProductCancellation(product: BillingProduct, cancel: boolean) {
	const authUser = await getAuthorizedUser();
	const rows = await db.select({ subscription: billingSubscriptionsTable, item: billingSubscriptionItemsTable }).from(billingSubscriptionsTable).innerJoin(billingSubscriptionItemsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id)).where(eq(billingSubscriptionsTable.userId, authUser.id)).execute();
	const match = rows.find(({ item, subscription }) => item.productKey === product && ["active", "trialing", "past_due", "unpaid"].includes(subscription.status));
	if (!match) return { success: false, error: "Subscription product not found", code: "NOT_FOUND" as const };
	if (rows.some(({ subscription }) => subscription.id === match.subscription.id && rows.filter((row) => row.subscription.id === subscription.id).length > 1)) return { success: false, error: "This product is bundled with another product. Manage it in the billing portal.", code: "BUNDLED_SUBSCRIPTION" as const };
	const stripe = getServerStripe();
	await stripe.subscriptions.update(match.subscription.id, { cancel_at_period_end: cancel });
	return { success: true };
}

async function getAuthorizedUser() {
	const authUser = await validateAuth(false);
	/* istanbul ignore next */
	if (!authUser) {
		/* istanbul ignore next */
		throw new Error("Unauthorized");
	}
	return authUser;
}

export async function checkIfSubscriptionExists(productKey?: BillingProduct) {
	const authUser = await getAuthorizedUser();
	if (!authUser.stripeCustomerId) {
		return false;
	}

	const stripe = getServerStripe();

	const subscriptions = await stripe.subscriptions.list({
		customer: authUser.stripeCustomerId,
		status: "all",
		limit: 100,
	});

	const blockingStatuses: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "unpaid"];
	for (const subscription of subscriptions.data) {
		if (!blockingStatuses.includes(subscription.status)) continue;
		if (!productKey) return true;
		const products = await Promise.all((subscription.items?.data ?? []).map((item) => resolveBillingProductForPrice(item.price, stripe)));
		if (products.includes(productKey)) return true;
	}
	return false;
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

export async function generateCheckout(productKeys: BillingProduct[] | Array<{ product: BillingProduct; billingCycle: BillingCycle }>, billingCycle: BillingCycle = "yearly", returnUrl?: string, numokMetadata?: NumokStripeMetadata, source?: PaywallSource, checkoutOptions?: { idempotencyKey?: string; successUrl?: string; cancelUrl?: string }) {
	const authUser = await getAuthorizedUser();
	const selectedProducts = Array.from(new Map(productKeys.map((entry) => (typeof entry === "string" ? [entry, { product: entry, billingCycle }] : [`${entry.product}:${entry.billingCycle}`, entry]))).values());
	if (selectedProducts.length === 0) throw new Error("Select at least one product");
	const limit = await tryRateLimit({ key: "billing-checkout", points: 5, duration: 300, identifier: authUser.id });
	if (!limit.success) throw new Error("RATE_LIMITED: Please wait before starting another checkout");
	const entitlements = await resolveUserEntitlements(authUser);
	const ownership = await Promise.all(selectedProducts.map(async (entry) => ({ ...entry, owned: (await checkIfSubscriptionExists(entry.product)) || isProductOwnedByEntitlement(entry.product, entitlements) })));
	const productsToBuy = ownership.filter((entry) => !entry.owned).map((entry) => entry.product);
	if (productsToBuy.length === 0) throw new Error("You already own every selected product");
	const cookieStore = await cookies();
	const selectedPrices = await Promise.all(ownership.filter((entry) => !entry.owned).map(async (entry) => (await resolveBillingPrice(entry.product, entry.billingCycle)).priceId));

	const stripe = getServerStripe();
	const baseUrl = await getBaseUrl();
	const defaultReturnUrl = new URL("/dashboard/settings", baseUrl).toString();
	const cancelUrl =
		checkoutOptions?.cancelUrl ??
		(() => {
			if (!returnUrl) return defaultReturnUrl;
			try {
				const resolved = new URL(returnUrl, baseUrl);
				/* istanbul ignore next */
				if (resolved.origin !== baseUrl.origin) return defaultReturnUrl;
				return resolved.toString();
			} catch {
				/* istanbul ignore next */
				return defaultReturnUrl;
			}
		})();
	let stripeCustomerId = authUser.stripeCustomerId ?? null;

	if (!stripeCustomerId) {
		const customer = await stripe.customers.create({
			email: authUser.email,
			metadata: {
				userId: authUser.id,
				/* istanbul ignore next */
				source: source ?? "upgrade_modal",
			},
		});
		stripeCustomerId = customer.id;
		const persisted = await persistStripeCustomerId(authUser.id, customer.id);
		/* istanbul ignore next */
		if (!persisted) {
			/* istanbul ignore next */
			throw new Error("Failed to persist Stripe customer ID");
		}
		/* istanbul ignore next */
		console.info("[entitlements] stripe_customer_created_on_intent", { userId: authUser.id, customerId: customer.id, source: source ?? "upgrade_modal" });
	}

	const rawCode = cookieStore.get("offer")?.value;
	const campaignOffer = productsToBuy.length === 1 && productsToBuy[0] === BillingProduct.Pro ? await getActiveCampaignOffer() : null;
	const normalizedCookieCode = rawCode?.trim().toUpperCase();
	const normalizedCampaignCode = campaignOffer?.offerCode?.trim().toUpperCase();
	const offerCode = normalizedCookieCode || (campaignOffer?.autoApplyAtCheckout ? normalizedCampaignCode : undefined);
	let promo: Stripe.PromotionCode | null = null;
	if (offerCode && /^[A-Za-z0-9]+$/.test(offerCode)) {
		const promoList = await stripe.promotionCodes.list({
			code: offerCode,
			limit: 1,
		});
		/* istanbul ignore next */
		promo = promoList.data.length ? promoList.data[0] : null;
	}

	const baseSessionParams: Stripe.Checkout.SessionCreateParams = {
		line_items: selectedPrices.map((price) => ({ price, quantity: 1 })),
		client_reference_id: authUser.id,
		mode: "subscription",
		subscription_data: { metadata: { userId: authUser.id, products: productsToBuy.join(",") } },
		success_url: checkoutOptions?.successUrl ?? defaultReturnUrl,
		cancel_url: cancelUrl,
		customer: stripeCustomerId,
		metadata: {
			userId: authUser.id,
			source: source ?? "upgrade_modal",
			billingCycle,
			products: productsToBuy.join(","),
			billingCycles: ownership
				.filter((entry) => !entry.owned)
				.map((entry) => `${entry.product}:${entry.billingCycle}`)
				.join(","),
			campaignSlug: campaignOffer?.slug ?? "",
			offerCode: offerCode ?? "",
			...numokMetadata,
		},
		tax_id_collection: {
			enabled: true,
		},
		customer_update: { name: "auto", address: "auto" },
	};

	const createSession = async (usePromo: boolean) => {
		const params: Stripe.Checkout.SessionCreateParams = {
			...baseSessionParams,
			...(usePromo && promo ? { discounts: [{ promotion_code: promo.id }] } : { allow_promotion_codes: true }),
		};
		const idempotencyKey = checkoutOptions?.idempotencyKey ? `${checkoutOptions.idempotencyKey}:${usePromo && promo ? "promo" : "standard"}` : undefined;
		return idempotencyKey ? stripe.checkout.sessions.create(params, { idempotencyKey }) : stripe.checkout.sessions.create(params);
	};

	let session: Stripe.Checkout.Session;
	try {
		session = await createSession(true);
	} catch (error) {
		const err = error as Stripe.StripeRawError;
		/* istanbul ignore next */
		const msg = err?.message || "";
		/* istanbul ignore next */
		const code = err?.code || "";
		/* istanbul ignore next */
		const promoNotRedeemable = code === "promotion_code_not_redeemable" || msg.includes("promotion code cannot be redeemed");

		/* istanbul ignore next */
		if (promo && promoNotRedeemable) {
			session = await createSession(false);
		} else {
			/* istanbul ignore next */
			throw error;
		}
	}

	return session.url;
}

export async function generatePaymentLink(billingCycle: BillingCycle, returnUrl?: string, numokMetadata?: NumokStripeMetadata, source?: PaywallSource) {
	return generateCheckout([BillingProduct.Pro], billingCycle, returnUrl, numokMetadata, source);
}

export async function generateRunnerPaymentLink(billingCycle: BillingCycle, returnUrl?: string, source?: PaywallSource) {
	return generateCheckout([BillingProduct.RunnerSelfHosted], billingCycle, returnUrl, undefined, source);
}

export async function getPortalLink() {
	const authUser = await getAuthorizedUser();
	if (!authUser.stripeCustomerId) {
		throw new Error("User does not have a Stripe customer ID");
	}

	const stripe = getServerStripe();
	const baseUrl = await getBaseUrl();

	const session = await stripe.billingPortal.sessions.create({
		customer: authUser.stripeCustomerId,
		return_url: new URL("/dashboard/settings", baseUrl).toString(),
	});

	return session.url;
}
