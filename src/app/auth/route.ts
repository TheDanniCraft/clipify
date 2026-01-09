import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { getBaseUrl, isPreview, safeReturnUrl } from "@actions/utils";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const cookieStore = await cookies();

	const returnUrl = (await safeReturnUrl(url.searchParams.get("returnUrl"))) || null;

	const nonce = crypto.randomUUID();
	cookieStore.set("auth_nonce", nonce, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 10 * 60,
	});

	const baseUrl = await getBaseUrl();
	let callbackUrl = new URL("/callback", baseUrl);

	if ((await isPreview()) && process.env.PREVIEW_CALLBACK_URL) {
		callbackUrl = new URL(process.env.PREVIEW_CALLBACK_URL);
	}

	const state = jwt.sign({ nonce, returnUrl, date: new Date().toISOString() }, process.env.JWT_SECRET!, {
		expiresIn: "10m",
		algorithm: "HS256",
		issuer: "clipify",
	});

	const scopes = ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:read:chat", "user:write:chat", "user:bot", "channel:bot"];

	const authLink = new URL("https://id.twitch.tv/oauth2/authorize");
	authLink.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID || "");
	authLink.searchParams.set("redirect_uri", callbackUrl.toString());
	authLink.searchParams.set("response_type", "code");
	authLink.searchParams.set("scope", scopes.join(" "));
	authLink.searchParams.set("force_verify", "true");
	authLink.searchParams.set("state", state);

	return NextResponse.redirect(authLink.toString());
}
