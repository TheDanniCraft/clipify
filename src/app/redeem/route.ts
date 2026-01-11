import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "../actions/utils";

export async function GET(request: NextRequest) {
	const cookieStore = await cookies();
	const base = await getBaseUrl();

	const offerCode = request.nextUrl.searchParams.get("code");
	const redirectUrl = request.nextUrl.searchParams.get("redirect");
	const campaign = request.nextUrl.searchParams.get("campaign");

	if (!offerCode) return NextResponse.redirect(redirectUrl || "/");

	cookieStore.set("offer", offerCode, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	return NextResponse.redirect(new URL(`${redirectUrl || "/"}?utm_source=offer_redeem&utm_medium=offer&utm_campaign=${campaign || offerCode}`, base));
}
