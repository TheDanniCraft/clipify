import { NextResponse } from "next/server";

import { validateAuth } from "@actions/auth";
import { generateCheckout } from "@actions/subscription";
import { getBaseUrl } from "@actions/utils";
import { consumeCheckoutIntent } from "@/server/checkoutIntent";

export async function GET() {
	const baseUrl = await getBaseUrl();
	const user = await validateAuth();
	if (!user) return NextResponse.redirect(new URL("/login", baseUrl));
	const intent = await consumeCheckoutIntent();
	if (!intent) return NextResponse.redirect(new URL("/pricing", baseUrl));

	try {
		const checkoutUrl = await generateCheckout(intent.products, "yearly", undefined, undefined, intent.source, {
			idempotencyKey: `checkout-intent:${user.id}:${intent.nonce}`,
			successUrl: new URL("/checkout/success", baseUrl).toString(),
			cancelUrl: new URL("/pricing?checkout=cancelled", baseUrl).toString(),
		});
		return NextResponse.redirect(checkoutUrl ?? new URL("/pricing?checkout=unavailable", baseUrl).toString());
	} catch (error) {
		if (error instanceof Error && error.message === "You already own every selected product") return NextResponse.redirect(new URL("/dashboard/settings?tab=billing&billing=already-owned", baseUrl));
		throw error;
	}
}
