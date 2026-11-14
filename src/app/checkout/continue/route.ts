import { captureUnexpectedError } from "@lib/sentryServer";
import { recordConversionOperation } from "@/server/conversion-health";
import { NextResponse } from "next/server";

import { validateAuth } from "@actions/auth";
import { generateCheckout } from "@actions/subscription";
import { getBaseUrl } from "@actions/utils";
import { readCheckoutIntent, clearCheckoutIntent } from "@/server/checkoutIntent";

export async function GET() {
	const baseUrl = await getBaseUrl();
	const user = await validateAuth();
	if (!user) return NextResponse.redirect(new URL("/login", baseUrl));
	const intent = await readCheckoutIntent();
	if (!intent) return NextResponse.redirect(new URL("/pricing?checkout=unavailable", baseUrl));

	recordConversionOperation("checkoutRequested");
	try {
		const checkoutUrl = await generateCheckout(intent.products, "yearly", undefined, undefined, intent.source, {
			idempotencyKey: `checkout-intent:${user.id}:${intent.nonce}`,
			successUrl: new URL("/checkout/success", baseUrl).toString(),
			cancelUrl: new URL("/pricing?checkout=cancelled", baseUrl).toString(),
		});
		if (!checkoutUrl || typeof checkoutUrl === "object") {
			recordConversionOperation("checkoutUnavailable");
			return NextResponse.redirect(new URL("/pricing?checkout=unavailable", baseUrl));
		}
		recordConversionOperation("checkoutCreated");
		return NextResponse.redirect(checkoutUrl);
	} catch (error) {
		if (error instanceof Error && error.message === "You already own every selected product") {
			recordConversionOperation("checkoutAlreadyOwned");
			await clearCheckoutIntent();
			return NextResponse.redirect(new URL("/dashboard/settings?tab=billing&billing=already-owned", baseUrl));
		}
		if (error instanceof Error && error.message === "Unauthorized") return NextResponse.redirect(new URL("/login", baseUrl));
		recordConversionOperation("checkoutUnavailable");
		if (!(error instanceof Error && error.message.startsWith("RATE_LIMITED"))) captureUnexpectedError(error, "checkout", "continue");
		return NextResponse.redirect(new URL("/pricing?checkout=unavailable", baseUrl));
	}
}
