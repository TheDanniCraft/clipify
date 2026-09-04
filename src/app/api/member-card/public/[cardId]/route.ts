import { createMemberCardImage } from "@lib/memberCardImage";
import { getPublicMemberProfile } from "@lib/membership";

export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
	const { cardId } = await params;
	const profile = await getPublicMemberProfile(cardId);
	if (!profile) return new Response("Member not found", { status: 404 });
	const response = await createMemberCardImage(profile, new URL(request.url).searchParams.get("download") === "1");
	response.headers.set("X-Robots-Tag", "noindex");
	// Status-backed badges can change through grant revocation or expiry without a URL change.
	response.headers.set("Cache-Control", "no-store");
	return response;
}
