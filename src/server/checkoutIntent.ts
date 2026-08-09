import "server-only";

import crypto from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

import { BillingProduct } from "@types";
import type { BillingCycle } from "@lib/billingCatalog";

export const CHECKOUT_INTENT_COOKIE = "clipify_checkout_intent";
const CHECKOUT_INTENT_ISSUER = "clipify-checkout";
const CHECKOUT_INTENT_AUDIENCE = "clipify-checkout";

export type CheckoutIntentEntrypoint = "direct_cta" | "plan_builder" | "pricing_comparison" | "runner_addon";
export type CheckoutIntentProduct = { product: BillingProduct; billingCycle: BillingCycle };
export type CheckoutIntent = {
	v: 1;
	products: CheckoutIntentProduct[];
	source: "pricing_page";
	entrypoint: CheckoutIntentEntrypoint;
	nonce: string;
};

function isCycle(value: unknown): value is BillingCycle {
	return value === "monthly" || value === "yearly";
}

function isProduct(value: unknown): value is BillingProduct {
	return value === BillingProduct.Pro || value === BillingProduct.RunnerSelfHosted;
}

function isIntent(value: string | JwtPayload): value is JwtPayload & CheckoutIntent {
	if (typeof value === "string" || value.v !== 1 || value.source !== "pricing_page" || typeof value.nonce !== "string") return false;
	if (!Array.isArray(value.products) || value.products.length < 1 || value.products.length > 2) return false;
	if (!["direct_cta", "plan_builder", "pricing_comparison", "runner_addon"].includes(String(value.entrypoint))) return false;
	const products = value.products as unknown[];
	return (
		products.every((entry) => {
			if (!entry || typeof entry !== "object") return false;
			const candidate = entry as Record<string, unknown>;
			return isProduct(candidate.product) && isCycle(candidate.billingCycle);
		}) && new Set(products.map((entry) => (entry as CheckoutIntentProduct).product)).size === products.length
	);
}

export function encodeCheckoutIntent(input: Omit<CheckoutIntent, "v" | "nonce"> & { nonce?: string }) {
	const payload: CheckoutIntent = { ...input, v: 1, nonce: input.nonce ?? crypto.randomUUID() };
	if (!isIntent(payload as unknown as JwtPayload)) throw new Error("Invalid checkout intent");
	return jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: "HS256", issuer: CHECKOUT_INTENT_ISSUER, audience: CHECKOUT_INTENT_AUDIENCE });
}

export function decodeCheckoutIntent(value: string | undefined): CheckoutIntent | null {
	if (!value || !process.env.JWT_SECRET) return null;
	try {
		const decoded = jwt.verify(value, process.env.JWT_SECRET, { algorithms: ["HS256"], issuer: CHECKOUT_INTENT_ISSUER, audience: CHECKOUT_INTENT_AUDIENCE });
		return isIntent(decoded) ? { v: 1, products: decoded.products, source: decoded.source, entrypoint: decoded.entrypoint, nonce: decoded.nonce } : null;
	} catch {
		return null;
	}
}

export async function readCheckoutIntent() {
	const store = await cookies();
	const get = (store as unknown as { get?: (name: string) => { value?: string } | undefined }).get;
	return decodeCheckoutIntent(get?.call(store, CHECKOUT_INTENT_COOKIE)?.value);
}

export async function consumeCheckoutIntent() {
	const store = await cookies();
	const get = (store as unknown as { get?: (name: string) => { value?: string } | undefined }).get;
	const intent = decodeCheckoutIntent(get?.call(store, CHECKOUT_INTENT_COOKIE)?.value);
	store.set(CHECKOUT_INTENT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
	return intent;
}

export async function writeCheckoutIntent(intent: Omit<CheckoutIntent, "v" | "nonce"> & { nonce?: string }) {
	const store = await cookies();
	store.set(CHECKOUT_INTENT_COOKIE, encodeCheckoutIntent(intent), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	});
}

export async function clearCheckoutIntent() {
	const store = await cookies();
	store.set(CHECKOUT_INTENT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
