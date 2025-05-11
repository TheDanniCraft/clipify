import { NextRequest, NextResponse } from "next/server";
import { exchangeAccesToken } from "@actions/twitch";
import { setAccessToken } from "@actions/database";
import { authUser, getBaseUrl } from "@actions/auth";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const cookieStore = await cookies();

		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!code) {
			return authUser("codeError");
		}

		const receivedState = Buffer.from(state || "", "base64").toString("utf-8");
		const stateTimestamp = new Date(receivedState).getTime();
		const currentTimestamp = Date.now();

		if (isNaN(stateTimestamp) || currentTimestamp - stateTimestamp > 5 * 60 * 1000) {
			return authUser("stateError");
		}

		const token = await exchangeAccesToken(code);
		if (!token || !token.access_token) {
			return authUser("codeError");
		}
		const user = await setAccessToken(token);

		const cookieToken = await jwt.sign(user, process.env.JWT_SECRET!, {
			expiresIn: "1h",
		});

		await cookieStore.set("token", cookieToken, {
			httpOnly: true,
			sameSite: "lax",
			maxAge: 60 * 60 * 2,
		});

		const baseUrl = await getBaseUrl();

		return NextResponse.redirect(new URL("/dashboard", baseUrl));
	} catch (error) {
		const errorCode = await Sentry.captureException(error);

		return authUser("serverError", errorCode);
	}
}
