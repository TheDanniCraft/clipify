import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth/config";
import { clearAdminViewCookieForAuthFlow } from "@actions/auth";
import { safeReturnUrl } from "@actions/utils";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

export async function GET(request: NextRequest) {
	const signOutResponse = await auth.api.signOut({ headers: request.headers, body: {}, asResponse: true });
	const requestUrl = new URL(request.url);
	const login = new URL("/login", resolveBaseUrl());
	const returnUrl = await safeReturnUrl(requestUrl.searchParams.get("returnUrl"));
	if (returnUrl) login.searchParams.set("returnUrl", returnUrl);
	const redirect = NextResponse.redirect(login);
	redirect.cookies.delete("token");
	for (const cookie of signOutResponse.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
	await clearAdminViewCookieForAuthFlow();
	return redirect;
}
