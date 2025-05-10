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

export async function authUser(error?: string, errorCode?: string) {
	let url = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

	// If we are running inside coolify we need to strip the port and append a schemema
	if (Object.keys(process.env).some((key) => /^COOLIFY_/.test(key))) {
		url = `https://${url.replace(/:\d+/, "")}`;
	}

	const appUrl = new URL("/login", url);
	if (error) {
		appUrl.searchParams.set("error", error);
		appUrl.searchParams.set("errorCode", errorCode || "");
	}

	return NextResponse.redirect(appUrl);
}
