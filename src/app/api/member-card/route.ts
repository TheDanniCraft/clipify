import { validateAuth } from "@actions/auth";
import { createMemberCardImage } from "@lib/memberCardImage";
import { getMemberProfile } from "@lib/membership";

export async function GET(request: Request) {
	const user = await validateAuth();
	if (!user) return new Response("Unauthorized", { status: 401 });
	const profile = await getMemberProfile(user.id);
	if (!profile) return new Response("Member not found", { status: 404 });
	return createMemberCardImage(profile, new URL(request.url).searchParams.get("download") === "1");
}
