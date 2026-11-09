import { getEventParticipant } from "@/server/events/participant";
import { acceptAwardUpload } from "@/server/events/uploads";
import { uploadInputSchema } from "@/server/events/upload-policy";
import { consumeAppRateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
	const headers = { "Cache-Control": "private, no-store" };
	const fail = (code: string, status: number) => Response.json({ ok: false, code }, { status, headers });
	const url = new URL(request.url),
		protocol = request.headers.get("x-forwarded-proto");
	const origin = `${protocol === "https" || protocol === "http" ? protocol + ":" : url.protocol}//${request.headers.get("host") ?? url.host}`;
	if (request.headers.get("origin") !== origin) return fail("ACCESS_DENIED", 403);
	const { eventId } = await params;
	const categoryId = new URL(request.url).searchParams.get("category");
	if (!/^[0-9a-f-]{36}$/i.test(eventId) || !categoryId || !/^[0-9a-f-]{36}$/i.test(categoryId) || !request.body) return fail("INVALID_INPUT", 400);
	let title: string;
	try {
		title = decodeURIComponent(request.headers.get("x-upload-title") ?? "");
	} catch {
		return fail("INVALID_INPUT", 400);
	}
	const input = uploadInputSchema.safeParse({ mime: request.headers.get("content-type"), size: Number(request.headers.get("x-upload-size")), title });
	if (!input.success) return fail("INVALID_INPUT", 400);
	const participant = await getEventParticipant();
	if (!participant) return fail("AUTHENTICATION_REQUIRED", 401);
	const limit = await consumeAppRateLimit({ key: "event-upload", identifier: participant.authUserId, points: 12, duration: 3600 });
	if (!limit.success) return fail("LIMIT_REACHED", 429);
	const result = await acceptAwardUpload(participant.authUserId, eventId, categoryId, input.data, request.body, request.signal);
	return Response.json(result, { status: result.ok ? 200 : result.code === "PHASE_CLOSED" || result.code === "LIMIT_REACHED" ? 409 : result.code === "INVALID_INPUT" ? 400 : 503, headers });
}
