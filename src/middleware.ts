import { NextResponse, NextRequest } from "next/server";
import { authUser } from "@actions/auth";

export async function middleware(request: NextRequest) {
	const token = request.cookies.get("token")?.value;

	if (!token) {
		return authUser(request.url);
	}

	NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/", "/dashboard/:path*"],
};
