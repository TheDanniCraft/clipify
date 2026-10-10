import { NextRequest } from "next/server";

import { auth } from "@/auth/config";
import { safeReturnUrl } from "@actions/utils";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const callbackURL = (await safeReturnUrl(url.searchParams.get("returnUrl"))) || "/dashboard";
	const response = await auth.api.signInSocial({
		headers: req.headers,
		body: {
			provider: "twitch",
			callbackURL,
			scopes: ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:read:chat", "user:write:chat", "user:bot", "channel:bot"],
		},
		asResponse: true,
	});
	// The social API returns JSON with a Location header; this GET entrypoint
	// must issue an HTTP redirect while preserving Better Auth's state cookies.
	if (response.ok && response.headers.has("location")) return new Response(null, { status: 302, headers: response.headers });
	return response;
}
