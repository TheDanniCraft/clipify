import { authUser } from "@/app/actions/auth";
import { cookies } from "next/headers";

export async function GET() {
	const cookieStore = await cookies();

	cookieStore.delete("token");

	return authUser();
}
