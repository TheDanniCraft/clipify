import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt, { type JwtPayload } from "jsonwebtoken";
import * as Sentry from "@sentry/nextjs";

import { exchangeAccesToken } from "@actions/twitch";
import { setAccessToken, touchUser } from "@actions/database";
import { authUser, clearAdminViewCookieForAuthFlow } from "@actions/auth";
import { getBaseUrl } from "@actions/utils";
import { operationalCount, operationalDuration } from "@lib/operationalHealth";

type OAuthStatePayload = JwtPayload & {
	nonce: string;
	returnUrl?: string | null;
	initiator?: string;
	date?: string;
};

function isOAuthStatePayload(p: string | JwtPayload): p is OAuthStatePayload {
	return typeof p === "object" && p !== null && typeof p.nonce === "string";
}

function getSafeReturnUrl(returnUrl: string | null, baseUrl: URL) {
	if (typeof returnUrl !== "string" || !returnUrl.trim()) {
		return new URL("/dashboard", baseUrl);
	}

	const raw = returnUrl.trim();

	if (raw.startsWith("//")) {
		return new URL("/dashboard", baseUrl);
	}

	let target: URL;
	try {
		target = new URL(raw, baseUrl);
	} catch {
		return new URL("/dashboard", baseUrl);
	}

	if (target.origin !== baseUrl.origin) {
		return new URL("/dashboard", baseUrl);
	}

	return target;
}

export async function GET(request: NextRequest) {
	const started = Date.now();
	const recordOutcome = (outcome: string) => {
		operationalCount("clipify.auth.callback", 1, { outcome });
		operationalDuration("clipify.auth.callback_duration", Date.now() - started, { outcome });
	};
	try {
		const url = new URL(request.url);
		const cookieStore = await cookies();

		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!code) {
			recordOutcome("missing_code");
			return authUser(undefined, "codeError");
		}

		if (!state || !state.trim()) {
			recordOutcome("missing_state");
			return authUser(undefined, "stateError");
		}

		let decoded: string | JwtPayload;
		try {
			decoded = jwt.verify(state, process.env.JWT_SECRET!, {
				algorithms: ["HS256"],
				issuer: "clipify",
			});
		} catch (e) {
			console.error("Invalid state", e);
			recordOutcome("invalid_state");
			return authUser(undefined, "stateError");
		}

		if (!isOAuthStatePayload(decoded)) {
			recordOutcome("invalid_state_payload");
			return authUser(undefined, "stateError");
		}
		const payload = decoded;

		const cookieNonce = cookieStore.get("auth_nonce")?.value;
		if (!cookieNonce || payload.nonce !== cookieNonce) {
			recordOutcome("nonce_mismatch");
			return authUser(undefined, "stateError");
		}
		cookieStore.set("auth_nonce", "", { path: "/", maxAge: 0 });

		const token = await exchangeAccesToken(code);
		if (!token?.access_token) {
			recordOutcome("token_exchange_failed");
			return authUser(undefined, "codeError");
		}

		const user = await setAccessToken(token);
		if (!user) {
			recordOutcome("user_sync_failed");
			return authUser(undefined, "userError");
		}

		const cookieToken = jwt.sign(user, process.env.JWT_SECRET!, {
			expiresIn: "1h",
			algorithm: "HS256",
			issuer: "clipify",
		});

		cookieStore.set("token", cookieToken, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: 60 * 60 * 2,
			path: "/",
		});
		await clearAdminViewCookieForAuthFlow();

		const baseUrl = await getBaseUrl();
		const returnUrl = getSafeReturnUrl(typeof payload.returnUrl === "string" ? payload.returnUrl : null, baseUrl);

		await touchUser(user.id);

		recordOutcome("success");
		return NextResponse.redirect(returnUrl);
	} catch (error) {
		recordOutcome("unexpected_error");
		const errorCode = await Sentry.captureException(error);
		return authUser(undefined, "serverError", errorCode);
	}
}
