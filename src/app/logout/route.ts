import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth/config";
import { clearAdminViewCookieForAuthFlow } from "@actions/auth";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

export async function GET(request: NextRequest) {
	const signOutResponse = await auth.api.signOut({ headers: request.headers, body: {}, asResponse: true });
	const redirect = NextResponse.redirect(new URL("/login", resolveBaseUrl()));
	redirect.cookies.delete("token");
	for (const cookie of signOutResponse.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
	await clearAdminViewCookieForAuthFlow();
	return redirect;
}
