import { getEventParticipant } from "@/server/events/participant";
import { serveAwardAsset } from "@/server/events/media";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { readAwardReview } from "@/server/events/review";
import { db } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string; assetId: string }> }) {
	const { eventId, assetId } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(assetId)) return new Response(null, { status: 404 });
	const participant = await getEventParticipant();
	const principal = await getVerifiedSessionPrincipal();
	let teamAuthorized = false;
	if (principal) {
		const [event] = await db.select({ ownerId: awardEventsTable.ownerId }).from(awardEventsTable).where(eq(awardEventsTable.id, eventId)).limit(1);
		if (event) teamAuthorized = (await readAwardReview(principal, event.ownerId, eventId)).ok;
	}
	return serveAwardAsset(eventId, assetId, request.headers.get("range"), request.signal, participant?.authUserId, teamAuthorized, new URL(request.url).searchParams.get("preview") ?? undefined);
}
