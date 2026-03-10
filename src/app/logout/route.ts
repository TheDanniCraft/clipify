import { authUser, clearAdminViewCookieForAuthFlow } from "@actions/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const cookieStore = await cookies();
	const error = request.nextUrl.searchParams.get("error") ?? undefined;

	cookieStore.delete("token");
	await clearAdminViewCookieForAuthFlow();

	return authUser(undefined, error);
}
