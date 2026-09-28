import { NextResponse, NextRequest } from "next/server";
import { authUser } from "@actions/auth";
import { Role } from "@types";
import { getAuthActorContext } from "@/auth/session";

export async function proxy(request: NextRequest) {
	const isAdminRoute = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
	const actor = await getAuthActorContext(request.headers);

	if (!actor) {
		return authUser(request.nextUrl.pathname);
	}
	const recoveryPath = "/dashboard/settings/account/recovery";
	if ((actor.accountStatus === "suspended" || actor.accountStatus === "purge_eligible") && request.nextUrl.pathname !== recoveryPath) {
		return NextResponse.redirect(new URL(recoveryPath, request.url));
	}

	if (isAdminRoute && actor.user.role !== Role.Admin) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/", "/dashboard/:path*", "/admin", "/admin/:path*"],
};
