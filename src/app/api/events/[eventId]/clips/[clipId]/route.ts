import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import { getTwitchClipPlaybackUrl } from "@/app/actions/twitch";
import { streamClipPreview } from "@/server/clip-preview-stream";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string; clipId: string }> }) {
	const { eventId, clipId } = await params;
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
	const previewToken = new URL(request.url).searchParams.get("preview") ?? undefined;
	const range = request.headers.get("range");
	if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[a-zA-Z0-9_-]{1,200}$/.test(clipId) || (previewToken !== undefined && previewToken.length > 100) || (range && !/^bytes=\d+-\d*$/.test(range))) return new Response(null, { status: 404, headers });
	try {
		const [event] = await db.select({ ownerId: awardEventsTable.ownerId }).from(awardEventsTable).where(eq(awardEventsTable.id, eventId)).limit(1);
		if (!event) return new Response(null, { status: 404, headers });
		const playbackUrl = await getTwitchClipPlaybackUrl(clipId, event.ownerId, { kind: "event", eventId, ...(previewToken !== undefined ? { previewToken } : {}) });
		if (!playbackUrl) return new Response(null, { status: 404, headers });
		return streamClipPreview(request, playbackUrl);
	} catch {
		return new Response(null, { status: 502, headers });
	}
}
