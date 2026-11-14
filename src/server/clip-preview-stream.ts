import "server-only";
import { EXPORT_LIMITS, isTrustedClipMediaUrl } from "./clip-export";
export async function streamClipPreview(request: Request, playbackUrl: string, started = performance.now()) {
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	const range = request.headers.get("range");
	if (!isTrustedClipMediaUrl(playbackUrl) || (range && !/^bytes=\d+-\d*$/.test(range))) return new Response(null, { status: 400, headers });
	try {
		const resolved = performance.now();
		const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
		const response = await fetch(playbackUrl, { signal, redirect: "manual", cache: "no-store", headers: range ? { Range: range } : undefined });
		if (!response.ok || !response.body || !["video/mp4", "application/octet-stream", "binary/octet-stream"].includes(response.headers.get("content-type")?.split(";")[0] ?? "") || Number(response.headers.get("content-length")) > EXPORT_LIMITS.file) {
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
		const outgoing = new Headers({ ...headers, "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Server-Timing": `playback;dur=${(resolved - started).toFixed(1)}, upstream;dur=${(performance.now() - resolved).toFixed(1)}` });
		for (const name of ["content-length", "content-range"]) {
			const value = response.headers.get(name);
			if (value) outgoing.set(name, value);
		}
		return new Response(body, { status: response.status === 206 ? 206 : 200, headers: outgoing });
	} catch {
		return new Response(null, { status: 502, headers });
	}
}
