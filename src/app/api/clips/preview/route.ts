import { getCreatorClipPreview } from "@actions/creatorLibrary";
import { isTrustedClipMediaUrl } from "@/server/clip-export";
import { streamClipPreview } from "@/server/clip-preview-stream";
export const runtime = "nodejs";
export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	const params = new URL(request.url).searchParams,
		creatorId = params.get("creatorId"),
		clipId = params.get("clipId"),
		range = request.headers.get("range");
	if (!creatorId || creatorId.length > 200 || !clipId || !/^[a-zA-Z0-9_-]{1,200}$/.test(clipId) || (range && !/^bytes=\d+-\d*$/.test(range))) return new Response(null, { status: 400, headers });
	try {
		const started = performance.now();
		const result = await getCreatorClipPreview({ creatorId, clipId, refresh: params.get("refresh") === "1" });
		if (!result?.playbackUrl || !isTrustedClipMediaUrl(result.playbackUrl)) return new Response(null, { status: 404, headers });
		return streamClipPreview(request, result.playbackUrl, started);
	} catch {
		return new Response(null, { status: 502, headers });
	}
}
