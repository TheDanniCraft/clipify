import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl, safeReturnUrl } from "../actions/utils";

export async function GET(request: NextRequest) {
	const cookieStore = await cookies();
	const base = await getBaseUrl();

	const offerCode = request.nextUrl.searchParams.get("code");
	const rawRedirectUrl = request.nextUrl.searchParams.get("redirect");
	const redirectUrl = (await safeReturnUrl(rawRedirectUrl)) || "/";
	const campaign = request.nextUrl.searchParams.get("campaign");

	if (!offerCode) return NextResponse.redirect(new URL(redirectUrl, base));

	cookieStore.set("offer", offerCode, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	const target = new URL(redirectUrl, base);
	target.searchParams.set("utm_source", "offer_redeem");
	target.searchParams.set("utm_medium", "offer");
	target.searchParams.set("utm_campaign", campaign || offerCode);

	return NextResponse.redirect(target);
}
