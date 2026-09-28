/* istanbul ignore file */
import { NextRequest } from "next/server";

import { auth } from "@/auth/config";
import { safeReturnUrl } from "@actions/utils";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const callbackURL = (await safeReturnUrl(url.searchParams.get("returnUrl"))) || "/dashboard";
	return auth.api.signInSocial({
		headers: req.headers,
		body: {
			provider: "twitch",
			callbackURL,
			scopes: ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:read:chat", "user:write:chat", "user:bot", "channel:bot"],
		},
		asResponse: true,
	});
}
