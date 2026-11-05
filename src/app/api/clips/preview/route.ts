import { getCreatorClipPreview } from "@actions/creatorLibrary";
import { isTrustedClipMediaUrl, EXPORT_LIMITS } from "@/server/clip-export";
export const runtime = "nodejs";
export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	const params = new URL(request.url).searchParams,
		creatorId = params.get("creatorId"),
		clipId = params.get("clipId"),
		range = request.headers.get("range");
	if (!creatorId || creatorId.length > 200 || !clipId || !/^[a-zA-Z0-9_-]{1,200}$/.test(clipId) || (range && !/^bytes=\d+-\d*$/.test(range))) return new Response(null, { status: 400, headers });
	try {
		const result = await getCreatorClipPreview({ creatorId, clipId, refresh: params.get("refresh") === "1" });
		if (!result?.playbackUrl || !isTrustedClipMediaUrl(result.playbackUrl)) return new Response(null, { status: 404, headers });
		const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
		const response = await fetch(result.playbackUrl, { signal, redirect: "manual", cache: "no-store", headers: range ? { Range: range } : undefined });
		if (!response.ok || !response.body || !["video/mp4", "application/octet-stream"].includes(response.headers.get("content-type")?.split(";")[0] ?? "") || Number(response.headers.get("content-length")) > EXPORT_LIMITS.file) {
			await response.body?.cancel();
			return new Response(null, { status: 502, headers });
		}
		let size = 0;
		const body = response.body.pipeThrough(
			new TransformStream<Uint8Array, Uint8Array>({
				transform(chunk, controller) {
					size += chunk.length;
					if (size > EXPORT_LIMITS.file) throw Error("byte_limit");
					controller.enqueue(chunk);
				},
			}),
		);
		const outgoing = new Headers({ ...headers, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" });
		for (const name of ["content-length", "content-range"]) {
			const value = response.headers.get(name);
			if (value) outgoing.set(name, value);
		}
		return new Response(body, { status: response.status === 206 ? 206 : 200, headers: outgoing });
	} catch {
		return new Response(null, { status: 502, headers });
	}
}
