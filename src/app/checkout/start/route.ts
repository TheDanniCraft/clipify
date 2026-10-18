import { NextRequest, NextResponse } from "next/server";

import { validateAuth } from "@actions/auth";
import { getBaseUrl } from "@actions/utils";
import { BillingProduct } from "@types";
import { writeCheckoutIntent, type CheckoutIntentEntrypoint, type CheckoutIntentProduct } from "@/server/checkoutIntent";

function cycle(value: string | null) {
	return value === "monthly" ? ("monthly" as const) : ("yearly" as const);
}

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	if (url.searchParams.get("runner") === "true") return NextResponse.redirect(new URL("/pricing?runner=included", await getBaseUrl()));
	const selectedCycle = cycle(url.searchParams.get("cycle"));
	const products: CheckoutIntentProduct[] = [];
	if (url.searchParams.get("plan") === "pro") products.push({ product: BillingProduct.Pro, billingCycle: selectedCycle });
	if (products.length === 0) return NextResponse.redirect(new URL("/login", await getBaseUrl()));

	const requestedEntrypoint = url.searchParams.get("entrypoint");
	const entrypoint: CheckoutIntentEntrypoint = ["direct_cta", "plan_builder", "pricing_comparison", "runner_addon"].includes(requestedEntrypoint ?? "") ? (requestedEntrypoint as CheckoutIntentEntrypoint) : "direct_cta";
	await writeCheckoutIntent({ products, source: "pricing_page", entrypoint });
	const authenticated = await validateAuth();
	return NextResponse.redirect(new URL(authenticated ? "/checkout/continue" : "/login", await getBaseUrl()));
}
