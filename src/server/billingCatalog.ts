import "server-only";

import type Stripe from "stripe";

import { BillingProduct } from "@types";
import { getProductForPrice, getPriceLookupKeys, type BillingCycle } from "@lib/billingCatalog";
import { getStripe } from "@/server/stripe";

export type ResolvedBillingPrice = {
	priceId: string;
	productId: string | null;
	amount: number | null;
	currency: string;
	formatted: string;
};

export type ResolvedBillingCatalog = Record<BillingProduct, Record<BillingCycle, ResolvedBillingPrice>>;

const CACHE_MS = 10 * 60 * 1000;
let cachedCatalog: { expiresAt: number; value: ResolvedBillingCatalog } | null = null;

function formatPrice(amount: number | null, currency: string) {
	return amount === null ? "Unavailable" : new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

function fallbackCatalog(): ResolvedBillingCatalog {
	return Object.fromEntries(Object.values(BillingProduct).map((product) => [product, Object.fromEntries((["monthly", "yearly"] as BillingCycle[]).map((cycle) => [cycle, { priceId: "", productId: null, amount: null, currency: "EUR", formatted: "Unavailable" }]))])) as ResolvedBillingCatalog;
}

function stripeId(value: string | Stripe.Product | Stripe.DeletedProduct | null) {
	return typeof value === "string" ? value : (value?.id ?? null);
}

function resolvedPrice(price: Stripe.Price): ResolvedBillingPrice {
	const amount = typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
	const currency = price.currency.toUpperCase();
	return { priceId: price.id, productId: stripeId(price.product), amount, currency, formatted: formatPrice(amount, currency) };
}

export async function resolveBillingCatalog(stripe?: Stripe, options: { strict?: boolean } = {}): Promise<ResolvedBillingCatalog> {
	if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.value;

	const fallback = fallbackCatalog();
	if (!stripe && !process.env.STRIPE_SECRET_KEY) return fallback;
	const client = stripe ?? getStripe();
	try {
		const entries = Object.values(BillingProduct).flatMap((product) => (["monthly", "yearly"] as BillingCycle[]).map((cycle) => ({ product, cycle, lookupKeys: getPriceLookupKeys(product, cycle) })));
		const response = await client.prices.list({ lookup_keys: entries.flatMap((entry) => entry.lookupKeys), active: true, limit: 100, expand: ["data.product"] });
		const byLookupKey = new Map(response.data.filter((price) => price.lookup_key).map((price) => [price.lookup_key!, price]));
		const value = Object.fromEntries(
			Object.values(BillingProduct).map((product) => [
				product,
				Object.fromEntries(
					(["monthly", "yearly"] as BillingCycle[]).map((cycle) => {
						const price = getPriceLookupKeys(product, cycle)
							.map((key) => byLookupKey.get(key))
							.find(Boolean);
						return [cycle, price ? resolvedPrice(price) : fallback[product][cycle]];
					}),
				),
			]),
		) as ResolvedBillingCatalog;
		cachedCatalog = { expiresAt: Date.now() + CACHE_MS, value };
		return value;
	} catch (error) {
		console.error("[billing] Failed to resolve Stripe lookup keys", error);
		if (options.strict) throw error;
		return fallback;
	}
}

export async function resolveBillingPrice(product: BillingProduct, cycle: BillingCycle, stripe?: Stripe) {
	const price = (await resolveBillingCatalog(stripe))[product][cycle];
	if (!price.priceId) throw new Error(`Missing active Stripe price for ${product}:${cycle}`);
	return price;
}

export async function resolveBillingProductForPrice(price: string | Stripe.Price, stripe?: Stripe): Promise<BillingProduct | null> {
	const priceId = typeof price === "string" ? price : price.id;
	const known = getProductForPrice(priceId);
	if (known) return known;
	if (!stripe && !process.env.STRIPE_SECRET_KEY) return null;
	const client = stripe ?? getStripe();

	const priceObject = typeof price === "string" ? await client.prices.retrieve(price, { expand: ["product"] }) : price;
	const productId = stripeId(priceObject.product);
	if (!productId) return null;
	// Product resolution drives persisted entitlements. A temporary Stripe failure
	// must abort synchronization instead of looking like an unknown product.
	const catalog = await resolveBillingCatalog(client, { strict: true });
	return Object.values(BillingProduct).find((product) => Object.values(catalog[product]).some((candidate) => candidate.productId === productId)) ?? null;
}

export function clearBillingCatalogCacheForTests() {
	cachedCatalog = null;
}
