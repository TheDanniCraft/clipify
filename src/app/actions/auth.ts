"use server";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function getUserFromCoookie(cookie: string) {
	try {
		const decodedToken = await jwt.verify(cookie, process.env.JWT_SECRET!);

		return decodedToken;
	} catch {
		return undefined;
	}
}

export async function authUser(url: string, error?: string, errorCode?: string) {
	const appUrl = new URL("/login", url);
	if (error) {
		appUrl.searchParams.set("error", error);
		appUrl.searchParams.set("errorCode", errorCode || "");
	}

	return NextResponse.redirect(appUrl);
}
