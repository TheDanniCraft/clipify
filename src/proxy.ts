import { NextResponse, NextRequest } from "next/server";
import { authUser, getUserFromCookie } from "@actions/auth";
import { Role } from "@types";

export async function proxy(request: NextRequest) {
	const token = request.cookies.get("token")?.value;
	const isAdminRoute = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");

	if (!token) {
		return authUser(request.nextUrl.pathname);
	}

	if (isAdminRoute) {
		const user = await getUserFromCookie(token);
		if (!user) {
			return authUser(request.nextUrl.pathname);
		}

		if (user.role !== Role.Admin) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/", "/dashboard/:path*", "/admin", "/admin/:path*"],
};
