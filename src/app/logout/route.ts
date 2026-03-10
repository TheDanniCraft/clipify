import { authUser, clearAdminViewCookieForAuthFlow } from "@actions/auth";
import { cookies } from "next/headers";

export async function GET() {
	const cookieStore = await cookies();

	cookieStore.delete("token");
	await clearAdminViewCookieForAuthFlow();

	return authUser();
}
