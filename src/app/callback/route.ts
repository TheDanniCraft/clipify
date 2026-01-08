import { NextRequest, NextResponse } from "next/server";
import { exchangeAccesToken } from "@actions/twitch";
import { setAccessToken } from "@actions/database";
import { authUser } from "@actions/auth";
import { getBaseUrl } from "@actions/utils";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import * as Sentry from "@sentry/nextjs";
function getSafeReturnUrl(returnUrl: string | null, baseUrl: URL) {
	if (typeof returnUrl !== "string" || !returnUrl.trim()) {
		return new URL("/dashboard", baseUrl);
	}

	const raw = returnUrl.trim();

	// Reject protocol-relative URLs like "//evil.com"
	if (raw.startsWith("//")) {
		return new URL("/dashboard", baseUrl);
	}

	let target: URL;

	try {
		// If raw is relative, this resolves it against base.
		target = new URL(raw, baseUrl);
	} catch {
		return new URL("/dashboard", baseUrl);
	}

	// Enforce same-origin (prevents redirecting to other domains)
	if (target.origin !== baseUrl.origin) {
		return new URL("/dashboard", baseUrl);
	}

	return target;
}

export async function GET(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const cookieStore = await cookies();

		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!code) {
			return authUser(undefined, "codeError");
		}

		const receivedState = JSON.parse(Buffer.from(state || "", "base64").toString("utf-8"));

		const stateTimestamp = new Date(receivedState.date).getTime();
		const currentTimestamp = Date.now();

		if (isNaN(stateTimestamp) || currentTimestamp - stateTimestamp > 5 * 60 * 1000) {
			return authUser(undefined, "stateError");
		}

		const token = await exchangeAccesToken(code);
		if (!token || !token.access_token) {
			return authUser(undefined, "codeError");
		}
		const user = await setAccessToken(token);

		if (!user) {
			return authUser(undefined, "userError");
		}

		const cookieToken = await jwt.sign(user, process.env.JWT_SECRET!, {
			expiresIn: "1h",
		});

		await cookieStore.set("token", cookieToken, {
			httpOnly: true,
			sameSite: "lax",
			maxAge: 60 * 60 * 2,
		});

		const baseUrl = await getBaseUrl();

		const returnUrl = getSafeReturnUrl(receivedState.returnUrl, baseUrl);
		return NextResponse.redirect(returnUrl);
	} catch (error) {
		const errorCode = await Sentry.captureException(error);

		return authUser(undefined, "serverError", errorCode);
	}
}
