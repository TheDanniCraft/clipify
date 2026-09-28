import { NextRequest, NextResponse } from "next/server";

import { safeReturnUrl } from "@actions/utils";

/** Legacy creator OAuth entrypoint: send users to the Better Auth login UI. */
export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url);
	const login = new URL("/login", requestUrl);
	const returnUrl = await safeReturnUrl(requestUrl.searchParams.get("returnUrl"));
	if (returnUrl) login.searchParams.set("returnUrl", returnUrl);
	return NextResponse.redirect(login);
}
